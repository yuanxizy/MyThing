Earth surface, normal, specular, night-light, and cloud textures were copied from the official [three.js example assets](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets):

- `earth_atmos_2048.jpg`
- `earth_normal_2048.jpg`
- `earth_specular_2048.jpg`
- `earth_lights_2048.png`
- `earth_clouds_1024.png`

The globe geometry, lighting, cloud motion, and atmosphere in this project are rendered with Three.js in `src/EarthGlobe.tsx`.


The cinematic surface uses NASA Earth Observatory's Blue Marble Next Generation (July), 5400 x 2700:
https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg
Credit: Reto Stockli, NASA Earth Observatory.
https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/

The WebGL halo is an artistic optical approximation with a narrow white core and a soft blue falloff, projected using the existing camera and globe geometry. It is not a physical volumetric atmosphere simulation.

## High resolution material upgrade

The runtime materials now use `MeshPhysicalMaterial`, with separate ocean/land roughness and reflectance, a generated daylight PMREM environment, normal-mapped clouds, Beer-Lambert cloud opacity, approximate cloud self-shading and moving cloud shadows. These are realtime shading approximations, not a full volumetric/path-traced atmospheric simulation.

- `surface-8192.jpg`: downsampled to 8192 x 4096 from NASA's native 21600 x 10800 July Blue Marble Next Generation surface, [source file](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x21600x10800.jpg). Credit: Reto Stockli, NASA Earth Observatory.
- `cloud-density-8192.webp`: native 8192 x 4096 cloud data, encoded as grayscale coverage/density rather than cloud color. [NASA source TIFF](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif), [dataset description](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds/77558l). Credit: Reto Stöckli, NASA Goddard Space Flight Center; enhancements by Robert Simmon. This is a composite dataset, not live weather.
- `terrain-normal-4096.png`: tangent-space normals derived from NASA's 21600 x 10800 [topography height map](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png). Latitude correction is applied; no vertex displacement changes the approved silhouette.
- `cloud-normal-4096.png`: an artistic relief approximation derived from the native cloud density field. The assumed cloud relief is not measured elevation.
- `ocean-mask-4096.png`: derived from the existing Three.js example specular map with land elevations removed using the NASA height field. It controls roughness and reflectance, not metallicness.

Reproduce local textures with `python scripts/prepare-earth-materials.py` (Pillow and NumPy). The source maps are cached in the OS temporary directory. NASA source detail is downsampled for the renderer; lower resolution previews are never enlarged to claim additional detail. All data maps remain in linear color space; only the surface color map is decoded as sRGB.
