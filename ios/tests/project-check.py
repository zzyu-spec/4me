"""Source/config integrity checks, not an Xcode build."""
from pathlib import Path
import plistlib, re
root=Path(__file__).resolve().parents[1]/'HarugyeolWidgets'
for file in (root/'Config').glob('*.plist'):
    plistlib.loads(file.read_bytes())
for target in ['App','Widget']:
    info=plistlib.loads((root/f'Config/{target}-Info.plist').read_bytes())
    ent=plistlib.loads((root/f'Config/{target}.entitlements').read_bytes())
    assert info['SharedAppGroup'] in ent['com.apple.security.application-groups']
    assert info['SharedKeychainGroup'] in ent['keychain-access-groups']
project=(root/'HarugyeolWidgets.xcodeproj/project.pbxproj').read_text()
paths=re.findall(r'"path" = "([^"]+)";',project)
for path in paths:
    if not path.endswith(('.app','.appex')): assert (root/path).is_file(),path
assert project.count('"PBXNativeTarget"')==2
assert project.count('"PBXSourcesBuildPhase"')==2
assert project.count('"PBXResourcesBuildPhase"')==2
assert 'DEVELOPMENT_TEAM' not in project
service=(root/'Shared/WidgetService.swift').read_text()
assert '"returnSecureToken": true' in service
assert 'request.httpMethod = "PATCH"' not in service
assert 'request.httpMethod = "DELETE"' not in service
assert 'mask.fieldPaths' in service
assert 'http.statusCode == 403 { throw WidgetFailure.signedOut }' in service
print('Plists, shared entitlements, file references and read-only/auth guards verified (not compiled).')
