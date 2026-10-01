"""Prepare native 8K/4K WebGL textures from NASA's high resolution source data."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
import tempfile
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = 300_000_000
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "earth"
CACHE = Path(tempfile.gettempdir()) / "mything-earth-materials"
SOURCES = {
    "surface-source.jpg": "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x21600x10800.jpg",
    "cloud-source.tif": "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif",
    "elevation-source.png": "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png",
}

def download(pair):
    name, url = pair
    target = CACHE / name
    if not target.exists():
        with urlopen(url, timeout=60) as response:
            target.write_bytes(response.read())
    return target

def normal_map(height, strength, latitude_correct=False):
    field = np.asarray(height, dtype=np.float32) / 255
    dx = (np.roll(field, -1, axis=1) - np.roll(field, 1, axis=1)) * .5
    dy = np.gradient(field, axis=0)
    if latitude_correct:
        latitude = np.linspace(np.pi / 2, -np.pi / 2, field.shape[0])
        dx /= np.maximum(.2, np.cos(latitude)).astype(np.float32)[:, None]
    normals = np.stack([-dx * strength, dy * strength, np.ones_like(field)], axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    return Image.fromarray(np.round((normals * .5 + .5) * 255).astype(np.uint8))

def main():
    CACHE.mkdir(exist_ok=True)
    OUTPUT.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, SOURCES.items()))
    surface = Image.open(CACHE / "surface-source.jpg").convert("RGB").resize((8192, 4096), Image.Resampling.LANCZOS)
    surface.save(OUTPUT / "surface-8192.jpg", quality=95, subsampling=0, optimize=True)
    clouds = Image.open(CACHE / "cloud-source.tif").convert("L")
    assert clouds.size == (8192, 4096), "Use the native cloud source, not an enlarged preview"
    clouds.save(OUTPUT / "cloud-density-8192.webp", quality=96, method=6)
    elevation = Image.open(CACHE / "elevation-source.png").convert("L").resize((4096, 2048), Image.Resampling.LANCZOS)
    # The NASA height field supplies actual relief; no geometry displacement is
    # applied, so the approved planet silhouette and rope relationship stay fixed.
    normal_map(elevation, 8848 / (40_075_000 / 4096), True).save(OUTPUT / "terrain-normal-4096.png", optimize=True)
    normal_map(clouds.resize((4096, 2048), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.7)), 18).save(OUTPUT / "cloud-normal-4096.png", optimize=True)
    water = Image.open(OUTPUT / "earth_specular_2048.jpg").convert("L").resize((4096, 2048), Image.Resampling.LANCZOS)
    mask = np.asarray(water).copy()
    mask[np.asarray(elevation) > 2] = 0
    Image.fromarray(mask).save(OUTPUT / "ocean-mask-4096.png", optimize=True)
    for name in ["surface-8192.jpg", "cloud-density-8192.webp", "terrain-normal-4096.png", "cloud-normal-4096.png", "ocean-mask-4096.png"]:
        print(f"{name}: {Image.open(OUTPUT / name).size}, {(OUTPUT / name).stat().st_size / 1048576:.2f} MiB", flush=True)

if __name__ == "__main__":
    main()
