import numpy as np
import trimesh as tm
import zipfile
from xml.sax.saxutils import escape

def box(extent, center):
    m = tm.creation.box(extents=extent)
    m.apply_translation(center)
    return m

def cylinder(radius, height, z=0, sections=96):
    m = tm.creation.cylinder(radius=radius, height=height, sections=sections)
    m.apply_translation([0, 0, z + height/2])
    return m

def union(items):
    return tm.boolean.union(items, engine='manifold')

def difference(a, b):
    return tm.boolean.difference([a, b], engine='manifold')

def component_count(mesh):
    import manifold3d
    solid=manifold3d.Manifold(manifold3d.Mesh(np.asarray(mesh.vertices,dtype=np.float32),np.asarray(mesh.faces,dtype=np.uint32)))
    return len(solid.decompose())

def export_3mf(objects, path, title):
    resources=[];build=[]
    for i,(name,mesh) in enumerate(objects,1):
        verts=''.join(f'<vertex x="{v[0]:.5f}" y="{v[1]:.5f}" z="{v[2]:.5f}"/>' for v in mesh.vertices)
        tris=''.join(f'<triangle v1="{f[0]}" v2="{f[1]}" v3="{f[2]}"/>' for f in mesh.faces)
        resources.append(f'<object id="{i}" type="model" name="{escape(name)}"><mesh><vertices>{verts}</vertices><triangles>{tris}</triangles></mesh></object>')
        build.append(f'<item objectid="{i}"/>')
    xml='<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">'+escape(title)+'</metadata><resources>'+''.join(resources)+'</resources><build>'+''.join(build)+'</build></model>'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as f:
        f.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        f.writestr('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        f.writestr('3D/3dmodel.model',xml)

