# JPI EDM File Format Specification

This document describes the JPI EDM binary file format as independently determined through analysis of JPI data files and publicly available documentation.

## Document Status

This specification was derived through:
1. Analysis of real JPI data files owned by the author
2. Public forum discussions about the format
3. General knowledge of binary file format conventions

## Overview

JPI EDM files consist of two main sections:
1. **ASCII Header Section** - Configuration and flight index
2. **Binary Data Section** - Compressed flight data records

## ASCII Header Section

Headers are ASCII text lines terminated by CR+LF (`\r\n`). Each header:
- Starts with `$` followed by a record type letter
- Contains comma-separated fields
- Ends with `*XX` where XX is a two-digit hex checksum

### Checksum Calculation

The checksum is the XOR of all bytes between `$` (exclusive) and `*` (exclusive).

```ruby
def calculate_checksum(line)
  # line includes $ at start, find content between $ and *
  content = line[1...line.index('*')]
  content.bytes.reduce(0) { |xor, byte| xor ^ byte }
end
```

### Header Record Types

#### $U - Aircraft Identification (Tail Number)
```
$U, N73898*2A
```
- Field 1: Tail number (may have trailing spaces)

#### $A - Alarm Limits
```
$A, 160, 120, 500, 450, 60, 1650, 230, 90*7D
```
- Field 1: Volts High × 10 (16.0V)
- Field 2: Volts Low × 10 (12.0V)
- Field 3: DIF alarm (°F)
- Field 4: CHT alarm (°F)
- Field 5: CLD (shock cooling) alarm (°F/min)
- Field 6: TIT alarm (°F)
- Field 7: Oil High (°F)
- Field 8: Oil Low (°F)

#### $F - Fuel Configuration
```
$F,0,40,0,2146,2990*6D
```
- Field 1: Empty/warning threshold
- Field 2: Full capacity
- Field 3: Warning level
- Field 4: K-factor 1
- Field 5: K-factor 2

#### $T - Download Timestamp (UTC)
```
$T, 12, 22, 25, 1, 46, 24833*5D
```
- Field 1: Month
- Field 2: Day
- Field 3: Year (2-digit)
- Field 4: Hour
- Field 5: Minute
- Field 6: Unknown (possibly sequence number)

#### $C - Configuration
```
$C,830,30781,23552,1024,25826,120,140,2014,2*55
```
- Field 1: Model number (830 = EDM-830)
- Field 2: Feature flags low word
- Field 3: Feature flags high word
- Field 4: Unknown flags
- Field 5: Unknown (possibly extended flags)
- Field 6-8: Additional configuration
- Field 9: Unknown

The feature flags indicate which data fields are recorded.

#### $P - Unknown
```
$P, 2*6E
```
Purpose not yet determined.

#### $H - Unknown
```
$H,0*54
```
Purpose not yet determined.

#### $D - Flight Directory Entry
```
$D, 1196, 3387*44
```
- Field 1: Flight number
- Field 2: Data length in 16-bit words

Multiple $D records appear, one per flight stored in the file.

#### $L - End of Headers
```
$L, 7594*4F
```
- Field 1: Unknown meaning

Binary data immediately follows this record.

## Binary Data Section

### Flight Header (14 bytes + 1 byte checksum)

Each flight's data begins with a header:

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 2 | flight_num | Flight number (matches $D record) |
| 2 | 4 | flags | Configuration flags |
| 6 | 2 | unknown | Unknown field |
| 8 | 2 | interval | Recording interval in seconds |
| 10 | 2 | date | Packed date (see below) |
| 12 | 2 | time | Packed time (see below) |
| 14 | 1 | checksum | Checksum of preceding 14 bytes |

All multi-byte values are little-endian.

### Date/Time Packing

**Date field (16 bits):**
```
Bits 0-4:   Day (1-31)
Bits 5-8:   Month (1-12)
Bits 9-15:  Year (offset from 2000 or 1900)
```

**Time field (16 bits):**
```
Bits 0-4:   Seconds ÷ 2 (0-29 representing 0-58 seconds)
Bits 5-10:  Minutes (0-59)
Bits 11-15: Hours (0-23)
```

### Data Records

Flight data uses delta compression. Each record contains only the *changes* from the previous record.

#### Record Structure

```
decode_flags[2]   - Which field groups are present (2 bytes, typically identical)
repeat_count      - Number of times to repeat previous record
field_flags[0-5]  - Which fields in each group changed (conditional)
scale_flags[0-1]  - High-byte present for EGT fields (conditional)
sign_flags[0-5]   - Add or subtract the delta (conditional)
field_deltas[]    - The actual delta values (conditional)
scale_deltas[]    - High bytes for 16-bit deltas (conditional)
checksum          - 1 byte checksum
```

#### Decode Flags

The decode_flags bytes indicate which groups of 8 fields are present:
- Bit 0-5: field_flags[0-5] and sign_flags[0-5] present
- Bit 6-7: scale_flags[0-1] present

#### Initial Values

All fields are initialized to 0xF0 (240) before the first record.

#### Applying Deltas

For each field where the corresponding bit is set in field_flags:
1. Read the delta byte
2. If sign_flags bit is set: subtract delta from current value
3. If sign_flags bit is clear: add delta to current value
4. If scale_flags bit is set: also read high byte and apply (value << 8)

### Data Fields Layout

The data is conceptually an array of 48+ 16-bit values. Field assignments vary by model.

#### EDM 730/830 Field Layout (estimated)

| Index | Field | Description |
|-------|-------|-------------|
| 0-3 | EGT1-4 | Exhaust Gas Temps (°F) |
| 4-5 | T1, T2 | TIT probes (°F) |
| 6-7 | Reserved | |
| 8-11 | CHT1-4 | Cylinder Head Temps (°F) |
| 12 | CLD | Cooling rate |
| 13 | OIL | Oil temperature (°F) |
| 14 | MARK | Event marker |
| 15 | Unknown | |
| 16 | CDT | Compressor Discharge Temp |
| 17 | IAT | Induction Air Temp |
| 18 | BAT | Battery voltage × 10 |
| 19 | OAT | Outside Air Temp (°F) |
| 20 | USD | Fuel used × 10 |
| 21 | FF | Fuel flow × 10 |
| ... | ... | Additional fields |
| 40+ | MAP | Manifold pressure × 10 |
| 41+ | RPM | Engine RPM |
| ... | GPS | Lat, Long, Alt, Ground Speed |

### GPS Data Fields

When GPS is connected to the EDM, the following fields are populated:
- **LAT** / **LATHI**: Latitude (low byte / high byte)
- **LONG** / **LONGHI**: Longitude (low byte / high byte)
- **ALT**: Altitude
- **GSPD**: Ground speed

The exact encoding of GPS coordinates requires further analysis with known ground-truth positions.

### Checksum Variants

Two checksum algorithms exist based on firmware version:
- **Old (firmware < 3.00)**: XOR of all bytes
- **New (firmware ≥ 3.00)**: Negative sum of all bytes (two's complement)

```ruby
def checksum_old(bytes)
  bytes.reduce(0) { |xor, b| xor ^ b }
end

def checksum_new(bytes)
  (-bytes.sum) & 0xFF
end
```

## File Identification

JPI files typically have:
- Extension: `.JPI` or `.DAT`
- First bytes: `$U,` (tail number header)

## References

This specification was independently derived. No copyrighted specifications were used in its creation.
