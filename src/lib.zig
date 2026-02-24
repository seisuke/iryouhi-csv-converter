const std = @import("std");
const builtin = @import("builtin");

var last_output_len_value: usize = 0;

const Allocator = std.mem.Allocator;
const allocator = if (builtin.target.cpu.arch == .wasm32) std.heap.wasm_allocator else std.heap.page_allocator;
const YearSuffix = "年";
const MonthSuffix = "月";
const Applicable = "該当する";

const Record = struct {
    date_raw: ?[]const u8 = null,
    category_raw: ?[]const u8 = null,
    hospital: ?[]const u8 = null,
    amount_raw: ?[]const u8 = null,
};

const CommaMode = enum {
    with_comma,
    without_comma,
};

const KeyValue = struct {
    key: []const u8,
    value: []const u8,
};

export fn alloc(len: usize) ?[*]u8 {
    const buf = allocator.alloc(u8, len) catch return null;
    return buf.ptr;
}

export fn dealloc(ptr: ?[*]u8, len: usize) void {
    if (ptr == null) return;
    const p = ptr.?;
    allocator.free(p[0..len]);
}

export fn last_output_len() usize {
    return last_output_len_value;
}

export fn convert(ptr: ?[*]u8, len: usize) ?[*]u8 {
    if (ptr == null) return null;
    const input = ptr.?[0..len];

    const result = convertInternal(input) catch |err| {
        const msg = errorMessage(err);
        last_output_len_value = msg.len;
        const out_buf = allocator.alloc(u8, msg.len) catch return null;
        std.mem.copyForwards(u8, out_buf, msg);
        return out_buf.ptr;
    };

    last_output_len_value = result.len;
    return result.ptr;
}

fn errorMessage(err: anyerror) []const u8 {
    return switch (err) {
        error.InvalidDate => "ERROR: 診療年月はYYYY年MM月の形式で入力してください",
        error.NoRecords => "ERROR: 変換対象の明細が見つかりませんでした",
        else => "ERROR: 変換に失敗しました",
    };
}

const Headers = struct {
    const person_name = "氏名";
    const date = "診療年月";
    const category = "診療区分";
    const hospital = "医療機関等名称";
    const amount = "窓口相当負担額（円）";

    const Key = enum {
        person_name,
        date,
        category,
        hospital,
        amount,
        unknown,
    };

    const map = std.StaticStringMap(Key).initComptime(.{
        .{ person_name, .person_name },
        .{ date, .date },
        .{ category, .category },
        .{ hospital, .hospital },
        .{ amount, .amount },
    });

    fn parse(key: []const u8) Key {
        return map.get(key) orelse .unknown;
    }
};

fn convertInternal(input: []const u8) ![]u8 {
    var output = std.array_list.Managed(u8).init(allocator);
    errdefer output.deinit();

    var person_name: ?[]const u8 = null;
    var record = Record{};
    var any_record = false;

    var it = std.mem.splitScalar(u8, input, '\n');
    while (it.next()) |line_raw| {
        var line = line_raw;
        if (line.len > 0 and line[line.len - 1] == '\r') {
            line = line[0 .. line.len - 1];
        }

        const kv = parseKeyValueLine(line) orelse continue;
        const key = kv.key;
        const value = kv.value;

        switch (Headers.parse(key)) {
            .person_name => {
                person_name = value;
            },
            .date => {
                record.date_raw = value;
            },
            .category => {
                record.category_raw = value;
            },
            .hospital => {
                record.hospital = value;
            },
            .amount => {
                record.amount_raw = value;

                if (record.date_raw != null and record.category_raw != null and record.hospital != null) {
                    try writeRecord(&output, person_name orelse "", &record);
                    any_record = true;
                }
                record = Record{};
            },
            .unknown => {},
        }
    }

    if (!any_record) return error.NoRecords;

    return output.toOwnedSlice();
}

fn writeRecord(out: *std.array_list.Managed(u8), person: []const u8, record: *const Record) !void {
    const category = record.category_raw orelse "";

    const is_drug = contains(category, "調剤") or contains(category, "薬") or contains(category, "医薬品");
    const is_care = contains(category, "介護");

    const treatment = if (!is_drug and !is_care) Applicable else "";
    const drug = if (is_drug) Applicable else "";
    const care = if (is_care) Applicable else "";
    const other = "";
    var digits_buf: [128]u8 = undefined;
    const formatted_digits = try formatDigits(record.amount_raw orelse "", &digits_buf);
    var date_buf: [10]u8 = undefined;
    const formatted_date = try formatPaymentDate(record.date_raw orelse "", &date_buf);

    try writeField(out, person, .with_comma);
    try writeField(out, record.hospital orelse "", .with_comma);
    try writeField(out, treatment, .with_comma);
    try writeField(out, drug, .with_comma);
    try writeField(out, care, .with_comma);
    try writeField(out, other, .with_comma);
    try writeField(out, formatted_digits, .with_comma);
    try writeField(out, "", .with_comma);
    try writeField(out, formatted_date, .without_comma);
    try out.appendSlice("\r\n");
}

fn formatPaymentDate(date_raw: []const u8, buffer: *[10]u8) ![]const u8 {
    const year_mark = std.mem.indexOf(u8, date_raw, YearSuffix) orelse return error.InvalidDate;
    const month_mark = std.mem.indexOf(u8, date_raw, MonthSuffix) orelse return error.InvalidDate;
    if (month_mark <= year_mark) return error.InvalidDate;

    const year_part = date_raw[0..year_mark];
    const month_part = date_raw[(year_mark + YearSuffix.len)..month_mark];

    if (year_part.len != 4) return error.InvalidDate;
    if (month_part.len < 1 or month_part.len > 2) return error.InvalidDate;
    if (date_raw.len != month_mark + MonthSuffix.len) return error.InvalidDate;
    if (!allDigits(year_part) or !allDigits(month_part)) return error.InvalidDate;

    const month_num = parseMonth(month_part) orelse return error.InvalidDate;
    if (month_num < 1 or month_num > 12) return error.InvalidDate;

    var tmp: [10]u8 = undefined;
    const formatted = try std.fmt.bufPrint(&tmp, "{d:0>2}/01/{s}", .{ month_num, year_part });
    if (formatted.len != buffer.len) return error.InvalidDate;
    @memcpy(buffer[0..formatted.len], formatted);
    return buffer[0..formatted.len];
}

fn allDigits(value: []const u8) bool {
    for (value) |c| {
        if (!std.ascii.isDigit(c)) return false;
    }
    return true;
}

fn parseMonth(value: []const u8) ?u8 {
    return std.fmt.parseInt(u8, value, 10) catch null;
}

fn formatDigits(value: []const u8, buffer: []u8) ![]const u8 {
    var idx: usize = 0;
    for (value) |c| {
        if (std.ascii.isDigit(c)) {
            if (idx >= buffer.len) return error.FormattedBufferTooSmall;
            buffer[idx] = c;
            idx += 1;
        }
    }
    return buffer[0..idx];
}

fn contains(hay: []const u8, needle: []const u8) bool {
    return std.mem.indexOf(u8, hay, needle) != null;
}

fn writeField(out: *std.array_list.Managed(u8), value: []const u8, comma_mode: CommaMode) !void {
    const needs_quotes = std.mem.indexOfAny(u8, value, ",\"\n\r") != null;
    if (!needs_quotes) {
        try out.appendSlice(value);
        if (comma_mode == .with_comma) try out.append(',');
        return;
    }

    try out.append('"');
    for (value) |c| {
        if (c == '"') {
            try out.append('"');
            try out.append('"');
        } else {
            try out.append(c);
        }
    }
    try out.append('"');
    if (comma_mode == .with_comma) try out.append(',');
}

fn parseKeyValueLine(line: []const u8) ?KeyValue {
    const split = findFirstUnquotedComma(line) orelse return null;
    const key_raw = line[0..split];
    const value_raw = line[(split + 1)..];
    if (findFirstUnquotedComma(value_raw) != null) return null;

    const key = trimAndDequote(key_raw);
    const value = trimAndDequote(value_raw);
    return .{ .key = key, .value = value };
}

fn trimAndDequote(raw: []const u8) []const u8 {
    const trimmed = std.mem.trim(u8, raw, " \t\r\n");
    if (trimmed.len >= 2 and trimmed[0] == '"' and trimmed[trimmed.len - 1] == '"') {
        return trimmed[1 .. trimmed.len - 1];
    }
    return trimmed;
}

fn findFirstUnquotedComma(s: []const u8) ?usize {
    var in_quotes = false;
    var i: usize = 0;
    while (i < s.len) : (i += 1) {
        const c = s[i];
        if (c == '"') {
            if (in_quotes and i + 1 < s.len and s[i + 1] == '"') {
                i += 1;
                continue;
            }
            in_quotes = !in_quotes;
            continue;
        }
        if (c == ',' and !in_quotes) return i;
    }
    return null;
}

fn readFixture(gpa: Allocator, path: []const u8) ![]u8 {
    return try std.fs.cwd().readFileAlloc(gpa, path, 10 * 1024 * 1024);
}

test "golden: convertInternal exact bytes" {
    const testing = std.testing;
    const gpa = testing.allocator;

    const input = try readFixture(gpa, "testdata/iryouhi.csv");
    defer gpa.free(input);

    const expected = try readFixture(gpa, "testdata/iryouhi_converted.csv");
    defer gpa.free(expected);

    const actual = try convertInternal(input);
    defer allocator.free(actual);

    try testing.expectEqualStrings(expected, actual);
}

test "golden: export API exact bytes" {
    const testing = std.testing;
    const gpa = testing.allocator;

    const input = try readFixture(gpa, "testdata/iryouhi.csv");
    defer gpa.free(input);

    const expected = try readFixture(gpa, "testdata/iryouhi_converted.csv");
    defer gpa.free(expected);

    const in_ptr = alloc(input.len) orelse return error.OutOfMemory;
    @memcpy(in_ptr[0..input.len], input);

    const out_ptr = convert(in_ptr, input.len) orelse return error.OutOfMemory;
    const out_len = last_output_len();
    const actual = out_ptr[0..out_len];

    try testing.expectEqualStrings(expected, actual);

    dealloc(in_ptr, input.len);
    dealloc(out_ptr, out_len);
}
