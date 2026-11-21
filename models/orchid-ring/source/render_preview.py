"""Render the actual exported mesh, not an AI concept image."""
from pathlib import Path
import zipfile, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent
NS={'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}

def read_3mf(path):
    with zipfile.ZipFile(path) as z:root=ET.fromstring(z.read('3D/3dmodel.model'))
    result=[]
    for o in root.findall('m:resources/m:object',NS):
        v=np.array([[float(t.attrib[a]) for a in ['x','y','z']] for t in o.findall('m:mesh/m:vertices/m:vertex',NS)])
        f=np.array([[int(t.attrib[a]) for a in ['v1','v2','v3']] for t in o.findall('m:mesh/m:triangles/m:triangle',NS)])
        result.append((o.attrib['name'],v,f))
    return result

def render(objects, output, size=(1500,1500), camera=(3,-6,3),target=(0,0,80),scale=7.0):
    ss=2;w,h=size
    im=Image.new('RGB',(w*ss,h*ss),(16,18,20));draw=ImageDraw.Draw(im)
    direction=np.array(camera,dtype=float);direction/=np.linalg.norm(direction)
    right=np.cross([0,0,1],direction);right/=np.linalg.norm(right)
    up=np.cross(direction,right);view=np.stack([right,up,direction],axis=1)
    tris=[];depth=[];colors=[]
    light=np.array([-0.7,-0.4,1]);light/=np.linalg.norm(light)
    fill=np.array([0.7,0.2,0.4]);fill/=np.linalg.norm(fill)
    for name,v,f in objects:
        triangles=v[f];n=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10)
        center=triangles.mean(axis=1);visible=(n@direction)>0
        n=n[visible];triangles=triangles[visible];center=center[visible]
        shade=0.42+0.42*np.maximum(0,n@light)+0.16*np.maximum(0,n@fill)
        half=light+direction;half/=np.linalg.norm(half)
        spec=np.maximum(0,n@half)**30*0.45
        base=np.array([237,235,230])
        color=np.clip(shade[:,None]*base+spec[:,None]*255,0,255).astype('uint8')
        proj=(triangles-np.array(target))@view
        xy=proj[:,:,:2]*[scale,-scale]+[w/2,h/2]
        tris.append(xy*ss);depth.append((center-np.array(target))@direction);colors.append(color)
    tris=np.concatenate(tris);depth=np.concatenate(depth);colors=np.concatenate(colors)
    for i in np.argsort(depth):draw.polygon([tuple(p) for p in tris[i]],fill=tuple(colors[i]))
    im.resize(size,Image.Resampling.LANCZOS).save(output)

def font(size):
    return ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',size)

def main():
    objects=read_3mf(ROOT/'ASSEMBLY_VIEW_ONLY.3mf')
    render(objects,ROOT/'front.png',size=(1100,1100),camera=(0,-.25,1),target=(0,0,0),scale=22)
    render(objects,ROOT/'side.png',size=(1000,1100),camera=(2,-5,4),target=(0,0,-5),scale=20)
    canvas=Image.new('RGB',(1800,1120),(16,18,20))
    canvas.paste(Image.open(ROOT/'front.png').resize((900,900)),(0,140))
    canvas.paste(Image.open(ROOT/'side.png').resize((820,902)),(940,160))
    d=ImageDraw.Draw(canvas)
    d.text((60,35),'蝴蝶兰 · 花戒 V4',font=font(52),fill=(238,236,229))
    d.text((65,108),'花心居中直立  /  花宽 42 mm  /  戒圈内径 17 mm',font=font(26),fill=(170,171,166))
    d.text((60,1070),'实际模型预览 · 中性白色仅用于看形状，透明 PETG 成品会透光并有层纹',font=font(24),fill=(161,163,155))
    canvas.save(ROOT/'preview.png')
    render(objects,ROOT/'center_detail.png',size=(1100,900),camera=(1,-5,2.4),target=(0,0,5),scale=65)
if __name__=='__main__':main()
