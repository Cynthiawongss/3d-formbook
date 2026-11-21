from pathlib import Path
import math,json
import numpy as np
import trimesh as tm
import manifold3d as mf
from organic_surfaces import organic_petal,orchid_lip
from mesh_utils import union,difference,box,export_3mf,component_count
ROOT=Path(__file__).resolve().parent

def ellipsoid(r,c):
    m=tm.creation.icosphere(subdivisions=3,radius=1)
    m.apply_scale(r);m.apply_translation(c);return m

def petal(length,width,angle,z0,rise=2.0,cup=.8,phase=0,xy=(0,0),thick=1.0):
    nr,ns=36,144
    polar=[(0.,0.)]+[(i/nr,j*2*np.pi/ns) for i in range(1,nr+1) for j in range(ns)]
    rho,theta=np.array(polar).T
    t=.5*(1+rho*np.cos(theta))
    x=rho*np.sin(theta)*width/2*(.82+.18*t)
    y=length*t-1.2
    z=z0+rise*t**1.8+cup*(x/(width/2))**2
    z+=.16*np.sin(theta*5+phase)*rho**4*np.sin(np.pi*t)
    # Very shallow veins, deliberately not the reference photograph's water droplets.
    z+=.07*np.cos(14*x/width+phase)*np.sin(np.pi*t)*rho
    a=np.radians(angle)
    xyz=np.stack([x*np.cos(a)-y*np.sin(a)+xy[0],x*np.sin(a)+y*np.cos(a)+xy[1],z],axis=1)
    thickness=thick+.28*np.exp(-t*9)
    vertices=np.concatenate([xyz+[0,0,1]*thickness[:,None]/2,xyz-[0,0,1]*thickness[:,None]/2])
    k=len(xyz);faces=[]
    for j in range(ns):faces.append([0,1+j,1+(j+1)%ns])
    for i in range(nr-1):
        for j in range(ns):
            a=1+i*ns+j;b=1+i*ns+(j+1)%ns;c=a+ns;d=b+ns
            faces.extend([[a,c,b],[b,c,d]])
    faces+= [[a+k,c+k,b+k] for a,b,c in faces.copy()]
    start=1+(nr-1)*ns
    for j in range(ns):
        a=start+j;b=start+(j+1)%ns
        faces.extend([[a,a+k,b],[b,a+k,b+k]])
    m=tm.Trimesh(vertices,np.array(faces),process=True)
    if m.volume<0:m.invert()
    assert m.is_volume and m.is_watertight
    return m

def ring_band():
    # 17 mm clear bore; softened radial/axial corners.
    section=[]
    for cx,cy,start in [(.5,1.4,0),(-.5,1.4,90),(-.5,-1.4,180),(.5,-1.4,270)]:
        for a in np.linspace(start,start+90,9,endpoint=False):
            section.append([9.4+cx+.4*np.cos(np.radians(a)),cy+.4*np.sin(np.radians(a))])
    v=[];n=256;k=len(section)
    for a in np.linspace(0,2*np.pi,n,endpoint=False):
        for r,y in section:v.append([r*np.cos(a),y,-11+r*np.sin(a)])
    f=[]
    for i in range(n):
        for j in range(k):
            a=i*k+j;b=i*k+(j+1)%k;c=((i+1)%n)*k+j;d=((i+1)%n)*k+(j+1)%k
            f.extend([[a,b,c],[b,d,c]])
    m=tm.Trimesh(v,f,process=True)
    if m.volume<0:m.invert()
    return m

def clean(mesh):
    solid=mf.Manifold(mf.Mesh(np.float32(mesh.vertices),np.uint32(mesh.faces)))
    assert solid.status()==mf.Error.NoError
    bodies=sorted(solid.decompose(),key=lambda m:m.volume(),reverse=True)
    residual=sum(abs(m.volume()) for m in bodies[1:])
    assert residual<.1,(len(bodies),residual)
    out=bodies[0].to_mesh()
    return tm.Trimesh(np.asarray(out.vert_properties)[:,:3],out.tri_verts,process=False)

def main():
    petals=[organic_petal(20,13,-2,1.6,3.3,.9,.3,'sepal'),
            organic_petal(20.5,14,145,1.6,2.8,.85,.6,'sepal'),
            organic_petal(19.8,14,-143,1.6,3.0,.95,1.3,'sepal'),
            organic_petal(22,22.5,68,2.65,4.1,1.4,.2),
            organic_petal(21.5,22,-66,2.65,4.6,1.65,1.5)]
    bounds=tm.util.concatenate(petals).bounds
    sf=42/(bounds[1,0]-bounds[0,0])
    for p in petals:p.apply_scale([sf,sf,1])
    # Center the column on the flower hub and stand it along the face normal (+Z).
    column=ellipsoid([1.15,1.15,2.6],[0,0,5.3])
    # Bring the formerly downward projecting lip upright around its root.
    lip=orchid_lip()
    lip.apply_translation([0,.3,-3.7])
    lip.apply_transform(tm.transformations.rotation_matrix(np.radians(-70),[1,0,0]))
    lip.apply_translation([0,0,3.7])
    flower=union(petals+[lip,ellipsoid([4.6,3.4,1.7],[0,0,1.7]),ellipsoid([2.5,2.2,1.1],[0,0,3]),column])
    # Broad keyed joint in the back, not six separate petal connections.
    flower=difference(flower,box([6.4,3.8,1.8],[0,0,.7]))
    band=union([ring_band(),box([6,3.4,2.5],[0,0,0])])
    flower,band=clean(flower),clean(band)
    parts={'01_Orchid_flower_42mm':flower,'02_Ring_ID17mm':band}
    overlap=tm.boolean.intersection([flower,band],engine='manifold')
    assert abs(overlap.volume)<.001,overlap.volume
    report={'column_axis':[0,0,1],'column_center_xy_mm':[0,0],'column_top_mm':7.9,'lip_rotation_from_v2_degrees':-70,'flower_size_mm':flower.extents.round(3).tolist(),'ring_inner_diameter_mm':17,'joint_pin_mm':[6,3.4,2.5],'joint_socket_mm':[6.4,3.8,1.8],'status':'Geometry validated. See print_validation.json for slicing status. Not sent to printer.','assembly_intersection_mm3':float(overlap.volume),'parts':{}}
    arranged=[]
    for i,(name,m) in enumerate(parts.items()):
        assert m.is_volume and m.is_watertight and component_count(m)==1,name
        local=m.copy()
        if i==1:local.apply_transform(tm.transformations.rotation_matrix(np.pi/2,[1,0,0]))
        local.apply_translation([0,0,-local.bounds[0,2]])
        local.export(ROOT/'parts'/f'{name}.stl')
        local.apply_translation([112 if i==0 else 157,122,0]);arranged.append((name,local))
        report['parts'][name]={'watertight':bool(m.is_watertight),'components':component_count(m),'volume_mm3':float(m.volume),'triangles':len(m.faces)}
    export_3mf(arranged,ROOT/'Orchid_Ring_V4_GEOMETRY_ONLY.3mf','Orchid ring 42 mm - ID17 - two pieces')
    export_3mf(list(parts.items()),ROOT/'ASSEMBLY_VIEW_ONLY.3mf','Orchid ring assembly reference')
    (ROOT/'validation.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
