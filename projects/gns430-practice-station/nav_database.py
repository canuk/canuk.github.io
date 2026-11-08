"""Extract the verified non-WAAS GNS 430 navigation database profile."""

import argparse
from dataclasses import dataclass
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import struct
import sys


FORMAT_REFERENCE = 'https://github.com/dimaryaz/jdmtool/blob/main/src/jdmtool/taw.py'
PROFILE = 'gnc400-us-nav-region4-v1'
MAX_TAW_SIZE = 8 * 1024 * 1024
PAYLOAD_SIZE = 3 * 1024 * 1024
SEPARATOR = bytes.fromhex('00 02 00 00 00 44 64 00 1b 00 00 00 41 c8 00')
LAYOUT_MARKERS = (
    (0x94, bytes.fromhex('d4 60 11 04 91 8d 05 41')),
    (0xb1, bytes.fromhex('62 01 00 ce 02 00 25 04 00 86 05 00 e7 06 00 ec 06 00 f4 06 00 0e 07 00')),
)


@dataclass(frozen=True)
class NavigationData:
    payload: bytes
    payload_offset: int
    cycle: str
    valid_from: datetime.date
    valid_until: datetime.date
    metadata_hex: str
    trailer_hex: str


class Reader:
    def __init__(self, data):
        self.data, self.position = data, 0

    def take(self, count):
        if count < 0 or count > len(self.data) - self.position:
            raise ValueError('The TAW file is truncated or has an invalid length.')
        start = self.position
        self.position += count
        return self.data[start:self.position]

    def expect(self, value):
        if self.take(len(value)) != value:
            raise ValueError('The TAW structure does not match the verified profile.')

    def number(self, size=4):
        return int.from_bytes(self.take(size), 'little')

    def sqa(self):
        parts = self.take(25).split(b'\0')
        if len(parts) != 4 or parts[0] != b'SQA' or parts[-1] != b'':
            raise ValueError('The TAW SQA field is invalid.')
        if any(value < 32 or value > 126 for part in parts for value in part):
            raise ValueError('The TAW SQA field contains unsupported characters.')


def validate_payload(data, cycle):
    if len(data) != PAYLOAD_SIZE:
        raise ValueError('The payload size differs from the verified 3 MiB US profile.')
    for offset, marker in LAYOUT_MARKERS:
        if data[offset:offset + len(marker)] != marker:
            raise ValueError('The payload layout differs from the verified trainer database profile.')
    dates = []
    for offset in (0x83, 0x87):
        month, day, year = struct.unpack_from('<BBH', data, offset)
        try:
            dates.append(datetime.date(year, month, day))
        except ValueError as error:
            raise ValueError('The payload contains an invalid database date.') from error
    valid_from, valid_until = dates
    payload_cycle = f'{valid_from.year % 100:02d}{data[0x82] + 1:02d}'
    if payload_cycle != cycle or not 2000 <= valid_from.year <= 2099:
        raise ValueError('The payload cycle does not match the TAW metadata.')
    if valid_until - valid_from != datetime.timedelta(days=28):
        raise ValueError('The payload dates differ from the verified 28-day interval.')
    return valid_from, valid_until


def parse_taw(data, expected_cycle):
    if not re.fullmatch(r'[0-9]{4}', expected_cycle):
        raise ValueError('Specify the expected four-digit database cycle, such as 2611.')
    if len(data) > MAX_TAW_SIZE:
        raise ValueError('The TAW file exceeds the supported 8 MiB inspection limit.')
    reader = Reader(data)
    reader.expect(b'pWa.d')
    reader.expect(SEPARATOR)
    reader.sqa()
    metadata_size = reader.number()
    if not 8 <= metadata_size <= 4096:
        raise ValueError('The TAW metadata size is invalid.')
    reader.expect(b'F')
    metadata = reader.take(metadata_size)
    if metadata[:4] != b'\x90\x01\x73\x00' or metadata[5] != 0 or metadata[7] != 0:
        raise ValueError('The TAW metadata layout differs from the verified compact profile.')
    try:
        family, coverage, kind = metadata[8:].decode('ascii').split('\0')
    except (ValueError, UnicodeDecodeError) as error:
        raise ValueError('The TAW family metadata is invalid.') from error
    if family != 'GNC 400':
        raise ValueError('The TAW family is not the verified non-WAAS GNC 400 family.')
    if coverage != 'US Garmin Navigation Database' or kind:
        raise ValueError('The TAW coverage differs from the verified US navigation profile.')
    cycle = f'{metadata[4]:02d}{metadata[6]:02d}'
    if metadata[4] > 99 or not 1 <= metadata[6] <= 14 or cycle != expected_cycle:
        raise ValueError('The TAW cycle does not match the expected database cycle.')
    body_size = reader.number()
    reader.expect(b'R')
    body_end = reader.position + body_size
    if body_size > len(data) - reader.position - 25:
        raise ValueError('The TAW body length exceeds the available data.')
    reader.expect(b'KpGrd')
    reader.expect(SEPARATOR)
    reader.sqa()
    section_size = reader.number()
    reader.expect(b'R')
    if reader.number(2) != 4:
        raise ValueError('The TAW file does not contain the required region 4.')
    if reader.number() != 0:
        raise ValueError('The region 4 offset must be zero for this profile.')
    payload_size = reader.number()
    if payload_size != PAYLOAD_SIZE or section_size != payload_size + 10:
        raise ValueError('The region 4 payload or section size is unsupported.')
    offset = reader.position
    payload = reader.take(payload_size)
    if reader.position != body_end:
        raise ValueError('The TAW file contains multiple regions or an invalid body length.')
    if reader.number() != 20:
        raise ValueError('The TAW trailer size differs from the verified profile.')
    reader.expect(b'S')
    trailer = reader.take(20)
    if reader.position != len(data):
        raise ValueError('The TAW file contains trailing data.')
    valid_from, valid_until = validate_payload(payload, cycle)
    return NavigationData(payload, offset, cycle, valid_from, valid_until, metadata.hex(), trailer.hex())


def private_write(path, data):
    with Path(path).open('xb') as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(data)


def extract_candidate(source, output, expected_cycle):
    source, output = Path(source), Path(output)
    with source.open('rb') as file:
        before = os.fstat(file.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_TAW_SIZE:
            raise ValueError('Use a regular TAW download file of at most 8 MiB.')
        data = file.read(MAX_TAW_SIZE + 1)
        after = os.fstat(file.fileno())
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError('The source changed during extraction. Retry after the download completes.')
    candidate = parse_taw(data, expected_cycle)
    manifest = {
        'schema': 'gns430-nav-candidate-v1', 'profile': PROFILE, 'private_files': True,
        'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source': {'name': source.name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()},
        'payload': {'file': 'trainer.ndb', 'size': len(candidate.payload),
                    'sha256': hashlib.sha256(candidate.payload).hexdigest(), 'region': 4,
                    'source_offset': candidate.payload_offset},
        'cycle': candidate.cycle, 'valid_from': candidate.valid_from.isoformat(),
        'valid_until': candidate.valid_until.isoformat(), 'family': 'GNC 400',
        'coverage': 'US Garmin Navigation Database', 'metadata_hex': candidate.metadata_hex,
        'opaque_trailer_hex': candidate.trailer_hex, 'format_reference': FORMAT_REFERENCE,
        'vendor_authentication': 'not_verified', 'runtime_acceptance': 'pending',
        'main_firmware': 'unchanged',
    }
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    private_write(output / '.gitignore', b'*\n')
    private_write(output / 'trainer.ndb', candidate.payload)
    private_write(output / 'manifest.json', (json.dumps(manifest, indent=2) + '\n').encode())
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Read the licensed non-WAAS US TAW download.')
    parser.add_argument('--expected-cycle', required=True, help='Require this four-digit database cycle.')
    parser.add_argument('--output', type=Path, required=True, help='Create a new private candidate directory.')
    args = parser.parse_args()
    manifest = extract_candidate(args.source, args.output, args.expected_cycle)
    print(json.dumps({'candidate': str(args.output.resolve()), 'cycle': manifest['cycle'],
                      'payload_sha256': manifest['payload']['sha256'], 'runtime_acceptance': 'pending'}))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        print(f'Navigation database extraction failed: {error}', file=sys.stderr)
        raise SystemExit(1)
