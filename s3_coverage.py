#!/usr/bin/env python3
import argparse
import json
import logging
import re
from typing import Dict
from urllib.parse import urlparse

import boto3
import mercantile
from shapely.geometry import box
from shapely.geometry import mapping
from shapely.ops import cascaded_union


def s3_tile_list(location: str) -> Dict[int, list]:
    url_parts = urlparse(location)
    s3_bucket = url_parts.netloc
    s3_path = url_parts.path.lstrip("/")
    logging.info(f"processing bucket: {s3_bucket} path:{s3_path}")
    s3 = boto3.client("s3")
    paginator = s3.get_paginator("list_objects_v2")
    zoom_tiles: Dict[int, list] = {}
    pages = paginator.paginate(Bucket=s3_bucket, Prefix=s3_path)
    for page in pages:
        for obj in page["Contents"]:
            match = re.search(r"(\d+)/(\d+)/(\d+)\.\w+$", obj["Key"])
            if match:
                z = int(match.groups()[0])
                x = int(match.groups()[1])
                y = int(match.groups()[2])
                if zoom_tiles.get(z) is None:
                    zoom_tiles[z] = []
                zoom_tiles[z].append((x, y))
            else:
                logging.info(f"key:{obj['Key']} did not match")
    return zoom_tiles


def generate_coverage_from_tile_dict(zoom_tiles: Dict[int, list]) -> dict:
    features = []
    for zoom, tiles in zoom_tiles.items():
        tile_geometries = []
        for x, y in tiles:
            tile_bounds = mercantile.bounds(x, y, zoom)
            tile_geometry = box(*tile_bounds)
            tile_geometries.append(tile_geometry)
        zoom_geometry = cascaded_union(tile_geometries)
        features.append(
            {
                "type": "Feature",
                "geometry": mapping(zoom_geometry),
                "properties": {"zoom": zoom},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def generate_coverage(location: str) -> dict:
    if location.startswith("s3://"):
        tiles = s3_tile_list(location)
    else:
        raise Exception("Unsupported location")
    return generate_coverage_from_tile_dict(tiles)


def main():
    parser = argparse.ArgumentParser(
        description="Generate GeoJSON showing coverage for tiles on s3"
    )
    parser.add_argument(
        "source", metavar="s3://location", type=str, nargs=1, help="Tile location"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    print(json.dumps(generate_coverage(args.source[0])))


if __name__ == "__main__":
    main()
