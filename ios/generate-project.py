#!/usr/bin/env python3
"""Generate the checked-in Xcode project without third-party tools."""
import hashlib, json, pathlib, plistlib, sys
ROOT = pathlib.Path(__file__).resolve().parent / 'HarugyeolWidgets'
outputs = {}
def put(path, text): outputs[ROOT / path] = text.encode() if isinstance(text, str) else text
def plist(path, value): put(path, plistlib.dumps(value, sort_keys=False))
put('Config/Shared.xcconfig', '''// Select your own signing Team in Xcode. No private credentials belong here.
HARUGYEOL_BUNDLE_BASE = com.zzyuspec.harugyeol
IPHONEOS_DEPLOYMENT_TARGET = 16.0
SWIFT_VERSION = 5.0
CODE_SIGN_STYLE = Automatic
TARGETED_DEVICE_FAMILY = 1,2
SDKROOT = iphoneos
SUPPORTED_PLATFORMS = iphoneos iphonesimulator
''')
common = {'CFBundleDevelopmentRegion':'ko', 'CFBundleExecutable':'$(EXECUTABLE_NAME)', 'CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)', 'CFBundleInfoDictionaryVersion':'6.0', 'CFBundleName':'$(PRODUCT_NAME)', 'CFBundleShortVersionString':'0.1.0', 'CFBundleVersion':'1', 'SharedAppGroup':'group.$(HARUGYEOL_BUNDLE_BASE).widgets', 'SharedKeychainGroup':'$(AppIdentifierPrefix)$(HARUGYEOL_BUNDLE_BASE).widgetauth'}
plist('Config/App-Info.plist', {**common, 'CFBundleDisplayName':'하루결 위젯', 'CFBundlePackageType':'APPL', 'LSRequiresIPhoneOS':True, 'UILaunchScreen':{}, 'UIApplicationSceneManifest':{'UIApplicationSupportsMultipleScenes':False}, 'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'], 'CFBundleURLTypes':[{'CFBundleURLName':'하루결 위젯', 'CFBundleURLSchemes':['harugyeolwidgets']}]})
plist('Config/Widget-Info.plist', {**common, 'CFBundleDisplayName':'하루결', 'CFBundlePackageType':'XPC!', 'NSExtension':{'NSExtensionPointIdentifier':'com.apple.widgetkit-extension'}})
for target in ['App','Widget']:
    plist(f'Config/{target}.entitlements', {'com.apple.security.application-groups':['group.$(HARUGYEOL_BUNDLE_BASE).widgets'], 'keychain-access-groups':['$(AppIdentifierPrefix)$(HARUGYEOL_BUNDLE_BASE).widgetauth']})
public = json.loads((ROOT.parent.parent / 'shared/firebase-config.json').read_text())
plist('Config/FirebaseConfig.plist', {k:public[k] for k in ['apiKey','projectId']})
objects = {}
def ident(key): return hashlib.sha256(key.encode()).hexdigest()[:24].upper()
def obj(key, isa, **values):
    i=ident(key); objects[i]={'isa':isa, **values}; return i
refs=[]
def ref(path, typ):
    result=obj('file:'+path, 'PBXFileReference', lastKnownFileType=typ, path=path, sourceTree='<group>'); refs.append(result); return result
sources=[ref(x,'sourcecode.swift') for x in ['Shared/Models.swift','Shared/AccountStore.swift','Shared/WidgetService.swift']]
app=ref('App/HarugyeolApp.swift','sourcecode.swift'); widget=ref('Widget/HarugyeolWidget.swift','sourcecode.swift')
resources=[ref(x,'text') for x in ['Shared/WidgetProjection.js','../../harugyeol/functions/reminder-model.js','Config/FirebaseConfig.plist']]
config=ref('Config/Shared.xcconfig','text.xcconfig')
for name in ['App-Info.plist','Widget-Info.plist','App.entitlements','Widget.entitlements']: ref('Config/'+name,'text.plist.xml')
appProduct=obj('appproduct','PBXFileReference',explicitFileType='wrapper.application',path='HarugyeolWidgetApp.app',sourceTree='BUILT_PRODUCTS_DIR')
widgetProduct=obj('widgetproduct','PBXFileReference',explicitFileType='wrapper.app-extension',path='HarugyeolWidgetExtension.appex',sourceTree='BUILT_PRODUCTS_DIR')
products=obj('products','PBXGroup',children=[appProduct,widgetProduct],name='Products',sourceTree='<group>')
main=obj('main','PBXGroup',children=refs+[products],sourceTree='<group>')
def configs(name, settings):
    ids=[]
    for mode in ['Debug','Release']:
        settings2={**settings, 'SWIFT_OPTIMIZATION_LEVEL':'-Onone' if mode=='Debug' else '-O'}
        ids.append(obj(name+mode,'XCBuildConfiguration',baseConfigurationReference=config,buildSettings=settings2,name=mode))
    return obj(name+'configs','XCConfigurationList',buildConfigurations=ids,defaultConfigurationIsVisible='0',defaultConfigurationName='Release')
projectID=ident('project'); widgetID=ident('Widgettarget')
def phase(name, kind, files, **settings):
    builds=[obj(name+file,'PBXBuildFile',fileRef=file) for file in files]
    return obj(name,kind,buildActionMask='2147483647',files=builds,runOnlyForDeploymentPostprocessing='0',**settings)
proxy=obj('proxy','PBXContainerItemProxy',containerPortal=projectID,proxyType='1',remoteGlobalIDString=widgetID,remoteInfo='HarugyeolWidgetExtension')
dep=obj('dep','PBXTargetDependency',target=widgetID,targetProxy=proxy)
embedfile=obj('embedfile','PBXBuildFile',fileRef=widgetProduct,settings={'ATTRIBUTES':['RemoveHeadersOnCopy']})
embed=obj('embed','PBXCopyFilesBuildPhase',buildActionMask='2147483647',dstPath='',dstSubfolderSpec='13',files=[embedfile],name='Embed App Extensions',runOnlyForDeploymentPostprocessing='0')
targets=[]
for name,src,product,bundle in [('App',app,appProduct,'$(HARUGYEOL_BUNDLE_BASE).widgetapp'),('Widget',widget,widgetProduct,'$(HARUGYEOL_BUNDLE_BASE).widgetapp.extension')]:
    targetname='HarugyeolWidgetApp' if name=='App' else 'HarugyeolWidgetExtension'
    settings={'PRODUCT_NAME':targetname,'PRODUCT_BUNDLE_IDENTIFIER':bundle,'INFOPLIST_FILE':f'Config/{name}-Info.plist','CODE_SIGN_ENTITLEMENTS':f'Config/{name}.entitlements','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks','GENERATE_INFOPLIST_FILE':'NO'}
    if name=='Widget': settings.update({'APPLICATION_EXTENSION_API_ONLY':'YES','SKIP_INSTALL':'YES'})
    phases=[phase(name+'Sources','PBXSourcesBuildPhase',sources+[src]),phase(name+'Resources','PBXResourcesBuildPhase',resources),phase(name+'Frameworks','PBXFrameworksBuildPhase',[])]
    if name=='App': phases.append(embed)
    targets.append(obj(name+'target','PBXNativeTarget',buildConfigurationList=configs(name,settings),buildPhases=phases,buildRules=[],dependencies=[dep] if name=='App' else [],name=targetname,productName=targetname,productReference=product,productType='com.apple.product-type.application' if name=='App' else 'com.apple.product-type.app-extension'))
obj('project','PBXProject',attributes={'BuildIndependentTargetsInParallel':'YES','LastUpgradeCheck':'1600'},buildConfigurationList=configs('Project',{'CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES'}),compatibilityVersion='Xcode 14.0',developmentRegion='ko',hasScannedForEncodings='0',knownRegions=['ko','en','Base'],mainGroup=main,productRefGroup=products,projectDirPath='',projectRoot='',targets=targets)
def serialize(value, level=0):
    if isinstance(value,dict): return '{\n'+''.join('\t'*(level+1)+json.dumps(k)+' = '+serialize(v,level+1)+';\n' for k,v in value.items())+'\t'*level+'}'
    if isinstance(value,list): return '('+', '.join(serialize(v,level) for v in value)+')'
    return json.dumps(str(value),ensure_ascii=False)
put('HarugyeolWidgets.xcodeproj/project.pbxproj','// !$*UTF8*$!\n'+serialize({'archiveVersion':'1','classes':{},'objectVersion':'56','objects':objects,'rootObject':projectID})+'\n')
put('HarugyeolWidgets.xcodeproj/xcshareddata/xcschemes/HarugyeolWidgets.xcscheme',f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets[0]}" BuildableName="HarugyeolWidgetApp.app" BlueprintName="HarugyeolWidgetApp" ReferencedContainer="container:HarugyeolWidgets.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets[0]}" BuildableName="HarugyeolWidgetApp.app" BlueprintName="HarugyeolWidgetApp" ReferencedContainer="container:HarugyeolWidgets.xcodeproj"/></BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES"/>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
failed=[]
for path, data in outputs.items():
    if '--check' in sys.argv:
        if not path.exists() or path.read_bytes()!=data: failed.append(str(path.relative_to(ROOT)))
    else:
        path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
if failed: raise SystemExit('Regenerate project: '+', '.join(failed))
print(f'{len(outputs)} project/configuration files '+('verified' if '--check' in sys.argv else 'generated'))
