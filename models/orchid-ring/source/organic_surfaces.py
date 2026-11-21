import numpy as np
import trimesh as tm

def bezier_outline(segments, samples=32):
    out=[]
    t=np.linspace(0,1,samples,endpoint=False)[:,None]
    for points in segments:
        a,b,c,d=np.array(points,dtype=float)
        out.append((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d)
    return np.concatenate(out)

def shell(boundary,height,thickness=1.0,center=None):
    boundary=np.array(boundary,float)
    if center is None:center=np.mean(boundary,axis=0)
    ns=len(boundary);nr=42
    xy=np.concatenate([np.array(center)[None,:]]+[center+(boundary-center)*(i/nr) for i in range(1,nr+1)])
    rho=np.concatenate([[0]]+[np.full(ns,i/nr) for i in range(1,nr+1)])
    xyz=np.column_stack([xy,height(xy[:,0],xy[:,1],rho)])
    f=[]
    for j in range(ns):f.append([0,1+j,1+(j+1)%ns])
    for i in range(nr-1):
        for j in range(ns):
            a=1+i*ns+j;b=1+i*ns+(j+1)%ns;c=a+ns;d=b+ns
            f.extend([[a,c,b],[b,c,d]])
    f=np.array(f);tri=xyz[f]
    normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
    vertexnorm=np.zeros_like(xyz)
    for j in range(3):np.add.at(vertexnorm,f[:,j],normals)
    vertexnorm/=np.maximum(np.linalg.norm(vertexnorm,axis=1)[:,None],1e-10)
    thick=thickness*(1-.10*rho**10)
    v=np.concatenate([xyz+vertexnorm*thick[:,None]/2,xyz-vertexnorm*thick[:,None]/2])
    k=len(xyz);faces=list(f)+list(f[:,[0,2,1]]+k)
    start=1+(nr-1)*ns
    for j in range(ns):
        a=start+j;b=start+(j+1)%ns
        faces.extend([[a,a+k,b],[b,a+k,b+k]])
    m=tm.Trimesh(v,faces,process=True)
    if m.volume<0:m.invert()
    assert m.is_volume and m.is_watertight
    return m

def organic_petal(length,width,angle,z0,rise,cup,phase=0,kind='petal'):
    if kind=='petal':
        seg=[[(0,0),(.15,.02),(.48,.16),(.49,.45)],[(.49,.45),(.55,.69),(.36,.98),(.10,.99)],[(.10,.99),(-.03,1.02),(-.12,.92),(-.24,.91)],[(-.24,.91),(-.49,.87),(-.55,.62),(-.46,.42)],[(-.46,.42),(-.37,.19),(-.12,.04),(0,0)]]
    else:
        seg=[[(0,0),(.23,.08),(.45,.31),(.44,.52)],[(.44,.52),(.43,.74),(.20,.94),(0,1)],[(0,1),(-.11,.98),(-.37,.82),(-.43,.60)],[(-.43,.60),(-.48,.38),(-.26,.10),(0,0)]]
    boundary=bezier_outline(seg)*[width,length]
    # Smooth asymmetry, not a repeated sinusoidal petal outline.
    boundary[:,0]+=.25*np.sin(np.pi*boundary[:,1]/length)*np.sin(phase)
    center=np.array([0,length*.48])
    def height(x,y,rho):
        t=np.clip(y/length,0,1);u=x/(width/2)
        z=z0+rise*(.45*t+.55*t*t)
        z+=cup*u*u*(.3+.7*np.sin(np.pi*t))
        z+=.38*np.sin(2*np.pi*t+phase)*u
        # Rolled outer rim, tapered away at the root.
        z+=.75*rho**8*np.sin(np.pi*t*.8)*(1+.3*np.sin(7*t+phase))
        z+=.18*np.sin(5*u+2*t+phase)*np.sin(np.pi*t)
        for a in [-.48,0,.48]:
            z+=.10*np.exp(-((u-a*np.sin(np.pi*t/2))/.065)**2)*np.sin(np.pi*t)
        return z
    m=shell(boundary,height,1.05,center)
    m.apply_transform(tm.transformations.rotation_matrix(np.radians(angle),[0,0,1]))
    return m

def orchid_lip():
    # One curved three-lobed lip: raised side lobes and a projecting central tongue.
    seg=[[(0,0),(1.0,.3),(2.8,1.4),(3.1,2.7)],[(3.1,2.7),(3.6,3.4),(3.4,4.1),(1.9,4.5)],[(1.9,4.5),(1.4,5.2),(2.2,6.2),(1.6,7.3)],[(1.6,7.3),(.7,7.7),(.4,7.0),(0,7.0)],[(0,7.0),(-.4,7.0),(-.7,7.7),(-1.6,7.3)],[(-1.6,7.3),(-2.2,6.2),(-1.4,5.2),(-1.9,4.5)],[(-1.9,4.5),(-3.4,4.1),(-3.6,3.4),(-3.1,2.7)],[(-3.1,2.7),(-2.8,1.4),(-1.0,.3),(0,0)]]
    boundary=bezier_outline(seg,24)
    def height(x,y,rho):
        t=np.clip(y/7.5,0,1)
        return 3.7+3.2*np.sin(np.pi*t)+.9*t+2.3*(x/3.4)**2*np.sin(np.pi*t)
    m=shell(boundary,height,1.05,center=np.array([0,3.5]))
    m.apply_transform(tm.transformations.rotation_matrix(np.pi,[0,0,1]))
    m.apply_translation([0,-.3,0]);return m
