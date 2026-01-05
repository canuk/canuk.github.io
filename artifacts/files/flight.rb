# frozen_string_literal: true

require 'date'

module JpiEdmParser
  # Represents a single flight's data from a JPI file
  class Flight
    # Field index mapping - derived from format documentation
    # Some fields use two indices: [low_byte, high_byte]
    FIELD_LABELS = {
      egt1: [0, 48], egt2: [1, 49], egt3: [2, 50],
      egt4: [3, 51], egt5: [4, 52], egt6: [5, 53],
      cht1: 8, cht2: 9, cht3: 10, cht4: 11, cht5: 12, cht6: 13,
      cld: 14, oil_t: 15, mark: 16, oil_p: 17, crb: 18,
      volt: 20, oat: 21, usd: 22, ff: 23, hp: 30,
      map: 40, rpm: [41, 42],
      hours: [78, 79],
      gspd: 85
    }.freeze

    NUM_FIELDS = 128
    DEFAULT_VALUE = 0xF0
    FLIGHT_HEADER_SIZE = 28  # 14 x 16-bit words

    attr_reader :flight_number, :date, :flags, :interval_secs, :records, :index_entry

    def initialize(index_entry:, data:, binary_offset:, config:)
      @index_entry = index_entry
      @data = data
      @binary_offset = binary_offset
      @config = config
      @records = []
      @flight_number = index_entry.flight_number
      @data_length = index_entry.data_length
    end

    # Parse the flight data
    def parse
      # Find the start of this flight's data
      @flight_start = find_flight_start
      return self unless @flight_start

      @raw_data = @data[@flight_start, @data_length]
      return self unless @raw_data && @raw_data.length >= FLIGHT_HEADER_SIZE

      parse_flight_header
      parse_data_records
      self
    end

    # Get start date/time as Time object
    def start_time
      @date
    end

    # Get recording interval in seconds
    def interval
      @interval_secs || 6
    end

    # Calculate flight duration in hours
    def duration_hours
      return 0 if @records.empty?
      (@records.length * interval) / 3600.0
    end

    # Export flight data to CSV
    def to_csv(filename = nil)
      csv_data = generate_csv

      if filename
        ::File.write(filename, csv_data)
      end

      csv_data
    end

    private

    def find_flight_start
      # Find the flight by searching for its flight number in big-endian
      flight_num_bytes = [@flight_number].pack('n')

      # Start searching from binary_offset
      pos = @binary_offset
      
      # The flight data should be sequential, but we search to be safe
      while pos < @data.length - FLIGHT_HEADER_SIZE
        if @data[pos, 2] == flight_num_bytes
          return pos
        end
        pos += 1
      end

      nil
    end

    def parse_flight_header
      # Flight header: 14 x 16-bit words, big-endian
      words = @raw_data[0, FLIGHT_HEADER_SIZE].unpack('n14')

      @flight_number_check = words[0]
      @flags = words[1] | (words[2] << 16)
      # words[3..10] are unknown/config values
      @interval_secs = words[11]

      # Date: day:5, month:4, year:7
      date_bits = words[12]
      day = date_bits & 0x1F
      month = (date_bits >> 5) & 0x0F
      year = ((date_bits >> 9) & 0x7F) + 2000

      # Time: secs:5 (stored as secs/2), mins:6, hrs:5
      time_bits = words[13]
      secs = (time_bits & 0x1F) * 2
      mins = (time_bits >> 5) & 0x3F
      hrs = (time_bits >> 11) & 0x1F

      begin
        @date = DateTime.new(year, month, day, hrs, mins, secs)
      rescue ArgumentError
        @date = nil
      end
    end

    def parse_data_records
      data = @raw_data[FLIGHT_HEADER_SIZE..-1]
      return if data.nil? || data.empty?

      # Initialize default values
      default_values = Array.new(NUM_FIELDS, DEFAULT_VALUE)
      default_values[FIELD_LABELS[:hp]] = 0 if FIELD_LABELS[:hp]

      # High bytes default to 0
      FIELD_LABELS.each do |_key, index|
        if index.is_a?(Array)
          default_values[index[1]] = 0
        end
      end

      previous_values = Array.new(NUM_FIELDS)
      current_date = @date
      gspd_bug = true
      offset = 0

      while offset < data.length - 5
        # Skip 1 unknown byte
        offset += 1
        break if offset + 4 > data.length

        # Read 2x16-bit decode_flags (should be equal)
        decode_flags1 = data[offset, 2].unpack1('n')
        decode_flags2 = data[offset + 2, 2].unpack1('n')
        offset += 4

        break if offset >= data.length

        # Read repeat count
        repeat_count = data.getbyte(offset)
        offset += 1

        # Validate decode flags match
        break unless decode_flags1 == decode_flags2

        decode_flags = decode_flags1

        # Handle repeat count
        repeat_count.times do
          if current_date
            current_date = current_date + Rational(@interval_secs, 86400)
          end
        end

        # Read field flags for each bit set in decode_flags
        field_flags = Array.new(16, 0)
        sign_flags = Array.new(16, 0)

        16.times do |i|
          if (decode_flags & (1 << i)) != 0
            break if offset >= data.length
            field_flags[i] = data.getbyte(offset)
            offset += 1
          end
        end

        16.times do |i|
          # Skip sign flags for bits 6 and 7
          if (decode_flags & (1 << i)) != 0 && i != 6 && i != 7
            break if offset >= data.length
            sign_flags[i] = data.getbyte(offset)
            offset += 1
          end
        end

        # Expand to 128-bit arrays
        expanded_field_flags = Array.new(NUM_FIELDS, 0)
        expanded_sign_flags = Array.new(NUM_FIELDS, 0)

        field_flags.each_with_index do |byte, i|
          8.times do |bit|
            expanded_field_flags[i * 8 + bit] = (byte & (1 << bit)) != 0 ? 1 : 0
          end
        end

        sign_flags.each_with_index do |byte, i|
          8.times do |bit|
            expanded_sign_flags[i * 8 + bit] = (byte & (1 << bit)) != 0 ? 1 : 0
          end
        end

        # Copy sign flags for high bytes from low bytes
        FIELD_LABELS.each do |_key, index|
          if index.is_a?(Array)
            expanded_sign_flags[index[1]] = expanded_sign_flags[index[0]]
          end
        end

        # Read and calculate values
        new_values = Array.new(NUM_FIELDS)

        NUM_FIELDS.times do |k|
          value = previous_values[k]

          if expanded_field_flags[k] != 0
            break if offset >= data.length
            diff = data.getbyte(offset)
            offset += 1

            diff = -diff if expanded_sign_flags[k] != 0

            if value.nil? && diff == 0
              # Skip - no change from nil
            else
              value = default_values[k] if value.nil?
              value += diff
              previous_values[k] = value
            end
          end

          new_values[k] = value || 0
        end

        # Build record from field mapping
        record = { date: current_date }

        FIELD_LABELS.each do |key, index|
          if index.is_a?(Array)
            low = new_values[index[0]]
            high = new_values[index[1]]
            record[key] = low + (high << 8)
          else
            record[key] = new_values[index]
          end
        end

        # GSPD bug workaround (stuck at 150 when no GPS)
        if record[:gspd] == 150 && gspd_bug
          record[:gspd] = 0
        elsif record[:gspd] && record[:gspd] > 0
          gspd_bug = false
        end

        # Clamp negative GSPD
        record[:gspd] = 0 if record[:gspd] && record[:gspd] < 0

        # Temperature conversion if unit is Fahrenheit
        if fahrenheit?
          convert_temps_to_celsius!(record)
        end

        @records << record

        if current_date
          current_date = current_date + Rational(@interval_secs, 86400)
        end
      end
    end

    def fahrenheit?
      # Bit 28 indicates Fahrenheit (1=F, 0=C)
      (@flags >> 28) & 1 == 1
    end

    def convert_temps_to_celsius!(record)
      temp_fields = %i[egt1 egt2 egt3 egt4 egt5 egt6
                       cht1 cht2 cht3 cht4 cht5 cht6
                       crb cld oil_t]
      temp_fields.each do |field|
        if record[field] && record[field] != 0
          record[field] = fahrenheit_to_celsius(record[field])
        end
      end
    end

    def fahrenheit_to_celsius(temp)
      ((temp - 32) * 5.0 / 9.0).round(2)
    end

    def generate_csv
      headers = [:date] + FIELD_LABELS.keys
      lines = [headers.map { |h| h.to_s.upcase }.join(',')]

      @records.each do |record|
        row = headers.map do |h|
          val = record[h]
          if val.is_a?(DateTime)
            val.strftime('%Y-%m-%d %H:%M:%S')
          else
            val.to_s
          end
        end
        lines << row.join(',')
      end

      lines.join("\n") + "\n"
    end
  end
end
