#!/usr/bin/env python3
"""Summarize site-clipped, projected Mars rasters for the OreWay field UI.

The script does not download data or infer planetary coordinates. Operators
provide explicit pixel samples for each named site so that no Earth-coordinate
assumption is applied to Mars products.
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import rasterio


STATION_IDS = ("base", "s1", "s2", "s3")
MOLA_URL = "https://pds-geosciences.wustl.edu/missions/mgs/mola.html"
CRISM_URL = "https://pds-geosciences.wustl.edu/missions/mro/crism.htm"


def pixel_mapping(values, option_name):
    """Parse repeated ID=column,row options into pixel coordinates."""
    result = {}
    for value in values:
        try:
            station_id, coordinates = value.split("=", 1)
            column_text, row_text = coordinates.split(",", 1)
            column, row = int(column_text), int(row_text)
        except ValueError as error:
            raise ValueError(
                f"{option_name} must use ID=COLUMN,ROW; received {value!r}."
            ) from error
        if station_id not in STATION_IDS:
            raise ValueError(
                f"Unknown station {station_id!r}; use {', '.join(STATION_IDS)}."
            )
        if station_id in result:
            raise ValueError(f"{option_name} repeats station {station_id!r}.")
        result[station_id] = (column, row)
    return result


def read_raster(path):
    """Read band 1 and retain an explicit finite-data mask."""
    with rasterio.open(path) as source:
        if source.count < 1:
            raise ValueError(f"{path} contains no raster bands.")
        values = source.read(1, masked=True)
        data = np.asarray(values.data, dtype=np.float64)
        valid = ~np.ma.getmaskarray(values) & np.isfinite(data)
        profile = {
            "width": source.width,
            "height": source.height,
            "crs": source.crs,
            "transform": source.transform,
            "name": Path(path).name,
        }
    if not valid.any():
        raise ValueError(f"{path} contains no finite, unmasked pixels.")
    return data, valid, profile


def metric_pixel_size(profile):
    """Return pixel dimensions in metres, requiring a projected metric grid."""
    crs = profile["crs"]
    transform = profile["transform"]
    if crs is None or not crs.is_projected:
        raise ValueError(
            "MOLA input must use a projected CRS; geographic degree grids "
            "cannot be used to calculate slope."
        )
    if abs(transform.b) > 1e-12 or abs(transform.d) > 1e-12:
        raise ValueError("Rotated MOLA grids are not supported.")
    if transform.a == 0 or transform.e == 0:
        raise ValueError("MOLA pixel dimensions must be non-zero.")
    try:
        units = crs.linear_units_factor
        metres_per_unit = units[1] if isinstance(units, tuple) else units
    except (AttributeError, TypeError, IndexError):
        raise ValueError("Could not determine projected CRS linear units.")
    if not isinstance(metres_per_unit, (int, float)) or not math.isfinite(
        metres_per_unit
    ) or metres_per_unit <= 0:
        raise ValueError("Projected CRS must define a valid linear unit.")
    return (
        abs(transform.a) * metres_per_unit,
        abs(transform.e) * metres_per_unit,
    )


def checked_pixel(data, valid, profile, station_id, pixel, needs_neighbours=False):
    """Read one site sample and reject nodata or out-of-bounds coordinates."""
    column, row = pixel
    width, height = profile["width"], profile["height"]
    margin = 1 if needs_neighbours else 0
    if column < margin or row < margin or column >= width - margin or row >= height - margin:
        raise ValueError(
            f"{station_id} pixel ({column},{row}) is outside the usable raster area."
        )
    if not valid[row, column]:
        raise ValueError(f"{station_id} pixel ({column},{row}) is nodata.")
    return float(data[row, column])


def slope_degrees(data, valid, row, column, pixel_x_m, pixel_y_m, elevation_to_m):
    """Estimate local slope from a centered 3-by-3 elevation neighborhood."""
    neighbours = (
        valid[row, column - 1]
        and valid[row, column + 1]
        and valid[row - 1, column]
        and valid[row + 1, column]
    )
    if not neighbours:
        raise ValueError(
            f"Pixel ({column},{row}) needs valid left, right, upper, and lower "
            "MOLA neighbors to calculate slope."
        )
    dz_dx = (
        (data[row, column + 1] - data[row, column - 1]) * elevation_to_m
        / (2 * pixel_x_m)
    )
    dz_dy = (
        (data[row - 1, column] - data[row + 1, column]) * elevation_to_m
        / (2 * pixel_y_m)
    )
    return math.degrees(math.atan(math.hypot(dz_dx, dz_dy)))


def summarize_mola(data, valid, profile, elevation_unit):
    """Summarize valid elevations and central-difference slope samples."""
    pixel_x_m, pixel_y_m = metric_pixel_size(profile)
    elevation_to_m = 1000.0 if elevation_unit == "km" else 1.0
    elevations = data[valid] * elevation_to_m
    core_valid = (
        valid[1:-1, 1:-1]
        & valid[1:-1, :-2]
        & valid[1:-1, 2:]
        & valid[:-2, 1:-1]
        & valid[2:, 1:-1]
    )
    if not core_valid.any():
        raise ValueError("MOLA raster has no valid 3-by-3 neighborhood for slope.")
    dz_dx = (
        data[1:-1, 2:] - data[1:-1, :-2]
    ) * elevation_to_m / (2 * pixel_x_m)
    dz_dy = (
        data[:-2, 1:-1] - data[2:, 1:-1]
    ) * elevation_to_m / (2 * pixel_y_m)
    slopes = np.degrees(np.arctan(np.hypot(dz_dx[core_valid], dz_dy[core_valid])))
    return {
        "pixelSizeMeters": [pixel_x_m, pixel_y_m],
        "elevationMeters": {
            "minimum": float(elevations.min()),
            "maximum": float(elevations.max()),
            "mean": float(elevations.mean()),
            "validPixelCount": int(elevations.size),
        },
        "slopeDegrees": {
            "minimum": float(slopes.min()),
            "maximum": float(slopes.max()),
            "mean": float(slopes.mean()),
            "validPixelCount": int(slopes.size),
        },
    }


def process(args):
    """Build the app dataset from user-selected MOLA and optional CRISM pixels."""
    mola_pixels = pixel_mapping(args.mola_pixel, "--mola-pixel")
    missing = set(STATION_IDS) - set(mola_pixels)
    if missing:
        raise ValueError(
            "Supply one --mola-pixel for every site: "
            + ", ".join(sorted(missing))
            + "."
        )
    crism_pixels = pixel_mapping(args.crism_pixel, "--crism-pixel")
    if crism_pixels and not args.crism:
        raise ValueError("--crism-pixel requires --crism.")
    input_paths = [Path(args.mola).resolve()]
    if args.crism:
        input_paths.append(Path(args.crism).resolve())
    output_path = Path(args.output).resolve()
    if output_path in input_paths:
        raise ValueError("Output path must not overwrite an input raster.")

    mola, mola_valid, mola_profile = read_raster(args.mola)
    mola_summary = summarize_mola(mola, mola_valid, mola_profile, args.elevation_unit)
    station_samples = []
    elevation_to_m = 1000.0 if args.elevation_unit == "km" else 1.0
    for station_id in STATION_IDS:
        column, row = mola_pixels[station_id]
        elevation = checked_pixel(
            mola, mola_valid, mola_profile, station_id, (column, row), True
        ) * elevation_to_m
        slope = slope_degrees(
            mola,
            mola_valid,
            row,
            column,
            mola_summary["pixelSizeMeters"][0],
            mola_summary["pixelSizeMeters"][1],
            elevation_to_m,
        )
        station_samples.append(
            {
                "id": station_id,
                "elevationMeters": elevation,
                "slopeDegrees": slope,
                "crismBandValue": None,
            }
        )

    layers = {
        "mola": {
            "instrument": "Mars Orbiter Laser Altimeter",
            "sourceUrl": MOLA_URL,
            "raster": mola_profile["name"],
            "provenance": "User-supplied raster; provenance is not independently verified.",
            "elevationInputUnit": args.elevation_unit,
            "thresholdsDeg": {"safeMaxExclusive": 2, "cautionMaxInclusive": 10},
            **mola_summary,
        }
    }

    if args.crism:
        crism, crism_valid, crism_profile = read_raster(args.crism)
        for sample in station_samples:
            pixel = crism_pixels.get(sample["id"])
            if pixel is not None:
                sample["crismBandValue"] = checked_pixel(
                    crism, crism_valid, crism_profile, sample["id"], pixel
                )
        layers["crism"] = {
            "instrument": "Compact Reconnaissance Imaging Spectrometer for Mars",
            "sourceUrl": CRISM_URL,
            "raster": crism_profile["name"],
            "band": 1,
            "provenance": "User-supplied single-band value; spectral interpretation is not inferred.",
        }

    return {
        "schemaVersion": 1,
        "target": {
            "name": "Syrtis Major Planum",
            "quadrangle": "MC-13",
            "latitudeDegrees": 8.4,
            "longitudeDegreesEast": 69.5,
        },
        "layers": layers,
        "stations": station_samples,
    }


def parse_args():
    """Define the raster, sample-pixel, unit, and output arguments."""
    parser = argparse.ArgumentParser(
        description="Create nasa_surface_data.json from site-clipped Mars rasters."
    )
    parser.add_argument("--mola", required=True, help="Projected MOLA elevation raster.")
    parser.add_argument("--crism", help="Optional single-band CRISM index raster.")
    parser.add_argument(
        "--mola-pixel",
        action="append",
        default=[],
        metavar="ID=COL,ROW",
        help="MOLA sample pixel for a site; repeat for base, s1, s2, and s3.",
    )
    parser.add_argument(
        "--crism-pixel",
        action="append",
        default=[],
        metavar="ID=COL,ROW",
        help="Optional CRISM sample pixel; repeat for each sampled site.",
    )
    parser.add_argument(
        "--elevation-unit",
        choices=("m", "km"),
        default="m",
        help="Units stored in the MOLA elevation raster (default: m).",
    )
    parser.add_argument(
        "--output",
        default="nasa_surface_data.json",
        help="Output JSON path (default: nasa_surface_data.json).",
    )
    return parser.parse_args()


def main():
    """Write the validated dataset atomically and report processing failures."""
    args = parse_args()
    try:
        dataset = process(args)
        output_path = Path(args.output)
        temporary_path = output_path.with_name(output_path.name + ".tmp")
        with temporary_path.open("w", encoding="utf-8", newline="\n") as output:
            json.dump(dataset, output, indent=2, allow_nan=False)
            output.write("\n")
        os.replace(temporary_path, output_path)
    except (OSError, ValueError, rasterio.errors.RasterioError) as error:
        print(f"nasa_data_processor: {error}", file=sys.stderr)
        return 2
    print(f"Wrote processed raster summaries to {output_path}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
