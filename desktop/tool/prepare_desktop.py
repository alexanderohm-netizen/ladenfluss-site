"""Generate missing native runners without replacing the application or tests."""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--platform', choices=('macos', 'windows'), required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / args.platform
if target.exists():
    print(f'Keeping existing {args.platform} runner.')
else:
    flutter = shutil.which('flutter')
    if not flutter:
        raise SystemExit('Flutter is required. Install Flutter 3.47.6 and retry.')
    with tempfile.TemporaryDirectory(prefix='ladenfluss-runner-') as folder:
        generated = Path(folder) / 'app'
        subprocess.run([
            flutter, 'create', '--no-pub', '--platforms', args.platform,
            '--project-name', 'ladenfluss_wws', '--org', 'de.ladenfluss',
            str(generated),
        ], check=True)
        shutil.copytree(generated / args.platform, target)
    print(f'Created {args.platform} runner; lib/, test/ and pubspec.yaml preserved.')
