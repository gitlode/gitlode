"""Validate dist scope and the separately sealed runtime layout."""
import hashlib
import os
import pathlib
import tarfile


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_runtime(runtime, item, archive, dependency_target, original_target):
    expected = {entry['path']: entry for entry in item['inventory']}
    assert all(name.startswith('dist/') for name in expected)
    directories = {'dist'}
    for name in expected:
        directories.update(str(p) for p in pathlib.PurePosixPath(name).parents if str(p) != '.')
    files = {}
    links = {}
    actual_directories = set()
    for current, dirs, names in os.walk(runtime, followlinks=False):
        for name in dirs + names:
            path = pathlib.Path(current) / name
            relative = path.relative_to(runtime).as_posix()
            if path.is_symlink():
                links[relative] = os.readlink(path)
            elif path.is_dir():
                actual_directories.add(relative)
            else:
                assert path.is_file(), relative
                files[relative] = {'path': relative, 'bytes': path.stat().st_size, 'sha256': sha(path)}
    assert actual_directories == directories, 'unexpected runtime directories'
    assert set(files) == set(expected) | {'package.json'}, 'runtime file path set'
    assert {name: files[name] for name in expected} == expected, 'dist bytes'
    prefix = 'runtimes/' + item['variant'] + '/'
    with tarfile.open(archive) as sealed:
        package = sealed.getmember(prefix + 'package.json')
        assert package.isfile()
        original = sealed.extractfile(package).read()
        link = sealed.getmember(prefix + 'node_modules')
        assert link.issym() and link.linkname == original_target, 'sealed dependency provenance'
    assert files['package.json']['bytes'] == len(original)
    assert files['package.json']['sha256'] == hashlib.sha256(original).hexdigest(), 'package metadata bytes'
    assert links == {'node_modules': str(dependency_target)}, 'runtime dependency links'
    assert (runtime / 'node_modules').resolve(strict=True) == dependency_target.resolve(strict=True)
    return {'variant': item['variant'], 'distFiles': len(expected), 'package': files['package.json'], 'dependencyTarget': str(dependency_target), 'originalDependencyTarget': original_target}
