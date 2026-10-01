from pathlib import Path
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import tempfile
from PIL import Image
import numpy as np
cache = Path(tempfile.gettempdir()) / 'mything-nasa-moon'
cache.mkdir(exist_ok=True)
base='https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/'
files=['lroc_color_poles_8k.tif','ldem_16.tif']
def fetch(name):
    path=cache/name
    if not path.exists():
        urllib.request.urlretrieve(base+name,path)
    return path
with ThreadPoolExecutor(max_workers=2) as pool:
    color_path,dem_path=list(pool.map(fetch,files))
output=Path('public/moon'); output.mkdir(exist_ok=True)
Image.open(color_path).convert('RGB').save(output/'surface-8k.jpg',quality=94,subsampling=0,optimize=True)
h=np.asarray(Image.open(dem_path),dtype=np.float32)
height,width=h.shape
# NASA LOLA float TIFF stores elevation in km above the 1737.4 km sphere.
# Convert east/north gradients to physical slopes, correcting longitude spacing.
lat=np.linspace(np.pi/2,-np.pi/2,height,dtype=np.float32)[:,None]
dx=1737.4*(2*np.pi/width)*np.maximum(np.cos(lat),0.08)
dy=1737.4*np.pi/height
sx=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))/(2*dx)
sy=(np.vstack((h[1:],h[-1:]))-np.vstack((h[:1],h[:-1])))/(2*dy)
# Tangent-space x points east, y points north (opposite image rows).
n=np.stack((-sx,sy,np.ones_like(h)),axis=-1)
n/=np.linalg.norm(n,axis=-1,keepdims=True)
normal=np.rint((n*.5+.5)*255).astype(np.uint8)
Image.fromarray(normal).save(output/'normal-5760.png',optimize=True)
print(f'Surface: 8192x4096; physical terrain normals: {width}x{height}; elevation range: {h.min():.2f} to {h.max():.2f} km')
