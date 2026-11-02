"""Prepare only known images and captions; archive instructions are never executed."""
import hashlib, json, pathlib, struct, uuid, zipfile

root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path('C:/Users/elles/Downloads/PC Remote Transfers')
dest = root / 'public/content-packs/sa-provinces'
dest.mkdir(parents=True, exist_ok=True)
namespace = uuid.UUID('8cd7d1ab-b970-49d8-8f72-18e38c01b509')
posts, duplicates = {}, []
for archive in sorted(source.glob('South_Africa_By_Province_Batch_*.zip')):
    with zipfile.ZipFile(archive) as z:
        if sum(i.file_size for i in z.infolist()) > 100_000_000:
            raise ValueError('Archive too large')
        manifest_path = next(n for n in z.namelist() if n.endswith('manifest.json'))
        prefix = manifest_path[:-len('manifest.json')]
        manifest = json.loads(z.read(manifest_path))
        for post in manifest['posts']:
            number = int(post['post_number'])
            if not 1 <= number <= 65:
                raise ValueError('Unexpected post number')
            for field in ['image', 'caption_file']:
                path = pathlib.PurePosixPath(post[field])
                if path.is_absolute() or '..' in path.parts or not str(path).startswith('posts/'):
                    raise ValueError('Unsafe archive path')
            image = z.read(prefix + post['image'])
            caption = z.read(prefix + post['caption_file']).decode('utf-8-sig').strip()
            if image[:8] != b'\x89PNG\r\n\x1a\n' or len(image) > 25*1024*1024:
                raise ValueError('Invalid image')
            signature = hashlib.sha256(image + caption.encode()).hexdigest()
            if number in posts:
                if posts[number]['signature'] != signature:
                    raise ValueError(f'Conflicting duplicate {number}')
                duplicates.append(number)
                continue
            width, height = struct.unpack('>II', image[16:24])
            file = f'{number:02}.png'
            (dest / file).write_bytes(image)
            posts[number] = {
                'number': number, 'id': str(uuid.uuid5(namespace, f'post:{number}')),
                'mediaId': str(uuid.uuid5(namespace, f'media:{number}')),
                'title': post['topic'], 'caption': caption,
                'path': '/content-packs/sa-provinces/' + file,
                'size': len(image), 'width': width, 'height': height,
                'signature': signature, 'sourceURL': post.get('source_url', ''),
                'reportingPeriod': post.get('reporting_period', ''),
            }
assert sorted(posts) == list(range(1, 66))
data = sorted(posts.values(), key=lambda p:p['number'])
(root / 'lib/province-pack.mjs').write_text('export const provincePack = '+json.dumps(data, ensure_ascii=True, indent=2)+';\n', encoding='utf-8')
(dest / 'provenance.json').write_text(json.dumps({'collection':'South Africa by Province','duplicatesRemoved':duplicates,'posts':data}, indent=2),encoding='utf-8')
print(f'Prepared {len(data)} unique drafts; removed duplicate posts {duplicates}.')
