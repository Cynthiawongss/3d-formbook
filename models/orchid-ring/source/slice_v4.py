"""V3 support-process trial. Original V2 meshes remain byte-identical."""
from pathlib import Path
import json, shutil, sys, subprocess, zipfile, hashlib
import trimesh as tm
from mesh_utils import export_3mf, box, component_count
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'orchid_ring_v2'
SLICER='/Applications/BambuStudio.app/Contents/MacOS/BambuStudio'

def slice_job(geometry,out,process,name):
    args=[SLICER,'--debug','2','--load-settings',str(ROOT/'config/machine.json')+';'+str(process),'--load-filaments',str(ROOT/'config/filament.json'),'--arrange','0','--orient','0','--slice','0','--export-3mf',name,'--outputdir',str(out),str(geometry)]
    with (out/'slice.log').open('w') as log:
        p=subprocess.run(args,stdout=log,stderr=subprocess.STDOUT)
    assert p.returncode==0, (out,p.returncode)
    result=json.loads((out/'result.json').read_text())
    assert result['return_code']==0,result
    plate=result['sliced_plates'][0]
    with zipfile.ZipFile(out/name) as z:
        settings=json.loads(z.read('Metadata/project_settings.config'))
        expected=json.loads(process.read_text())
        for k in ['support_top_z_distance','support_object_xy_distance','support_interface_top_layers']:
            assert settings[k]==expected[k],(k,settings[k],expected[k])
        assert settings['printer_model']=='Bambu Lab A1'
        assert settings['filament_type']==['PETG']
        gcode=z.read('Metadata/plate_1.gcode').decode()
        assert 'Support' in gcode
    return {'return_code':0,'estimated_seconds':plate['total_predication'],'filaments':plate['filaments'],'warnings':plate['warning_message'],'settings':{k:settings[k] for k in ['support_top_z_distance','support_object_xy_distance','support_interface_top_layers']}}

def main():
    result=slice_job(ROOT/'Orchid_Ring_V4_GEOMETRY_ONLY.3mf',ROOT,ROOT/'config/process.json','Orchid_Ring_V4_A1_PETG_TRIAL.3mf')
    result.update(physical_print_verified=False,sent_to_printer=False)
    (ROOT/'print_validation.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
if __name__=='__main__': main()
