# Lunar rendering assets

Credit: NASA's Scientific Visualization Studio. CGI Moon Kit, https://svs.gsfc.nasa.gov/4720/ .

- `surface-8k.jpg`: 8192 x 4096 JPEG converted from the 2019 LROC WAC color mosaic `lroc_color_poles_8k.tif`.
- `normal-5760.png`: 5760 x 2880 tangent-space normal map derived from LOLA `ldem_16.tif`, using elevation in kilometers relative to the 1737.4 km reference sphere. Longitude gradients are corrected for latitude; no color-image brightness is used as elevation.

Source assets:
https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif
https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16.tif

Regenerate with `python scripts/prepare-moon-assets.py` (Pillow and NumPy).
The material uses measured terrain normals with a 1.8 normal strength for readability at the app's fixed viewing distance. Relief is normal-mapped rather than geometry-displaced so the locked spherical silhouette and card-rope geometry remain unchanged. It does not simulate terrain self-shadowing or scientific lunar photometry.
