const std = @import("std");

var last_output_len_value: usize = 0;

const Allocator = std.mem.Allocator;
const allocator = std.heap.wasm_allocator;

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

const Record = struct {
    date_raw: ?[]const u8 = null,
    category_raw: ?[]const u8 = null,
    hospital: ?[]const u8 = null,
    amount_raw: ?[]const u8 = null,
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

        const fields = try parseCsvLine(allocator, line);
        defer freeFields(allocator, fields);

        if (fields.len != 2) continue;

        const key = std.mem.trim(u8, fields[0], " \t\r\n");
        const value = std.mem.trim(u8, fields[1], " \t\r\n");

        if (std.mem.eql(u8, key, "氏名")) {
            if (person_name) |p| allocator.free(p);
            person_name = try allocator.dupe(u8, value);
            continue;
        }

        if (std.mem.eql(u8, key, "診療年月")) {
            record.date_raw = try allocator.dupe(u8, value);
        } else if (std.mem.eql(u8, key, "診療区分")) {
            record.category_raw = try allocator.dupe(u8, value);
        } else if (std.mem.eql(u8, key, "医療機関等名称")) {
            record.hospital = try allocator.dupe(u8, value);
        } else if (std.mem.eql(u8, key, "窓口相当負担額（円）")) {
            record.amount_raw = try allocator.dupe(u8, value);

            if (record.date_raw != null and record.category_raw != null and record.hospital != null) {
                try writeRecord(&output, person_name orelse "", &record);
                any_record = true;
            }
            freeRecord(record);
            record = Record{};
        }
    }

    freeRecord(record);
    if (person_name) |p| allocator.free(p);

    if (!any_record) return error.NoRecords;

    return output.toOwnedSlice();
}

fn writeRecord(out: *std.array_list.Managed(u8), person: []const u8, record: *const Record) !void {
    const category = record.category_raw orelse "";

    const is_drug = contains(category, "調剤") or contains(category, "薬") or contains(category, "医薬品");
    const is_care = contains(category, "介護");

    const treatment = if (!is_drug and !is_care) "該当する" else "";
    const drug = if (is_drug) "該当する" else "";
    const care = if (is_care) "該当する" else "";
    const other = "";

    const amount_raw = record.amount_raw orelse "";
    const amount = try digitsOnly(allocator, amount_raw);
    defer allocator.free(amount);

    const date_raw = record.date_raw orelse "";
    const pay_date = try formatPaymentDate(allocator, date_raw);
    defer allocator.free(pay_date);

    try writeField(out, person);
    try out.append(',');
    try writeField(out, record.hospital orelse "");
    try out.append(',');
    try writeField(out, treatment);
    try out.append(',');
    try writeField(out, drug);
    try out.append(',');
    try writeField(out, care);
    try out.append(',');
    try writeField(out, other);
    try out.append(',');
    try writeField(out, amount);
    try out.append(',');
    try writeField(out, "");
    try out.append(',');
    try writeField(out, pay_date);
    try out.appendSlice("\r\n");
}

fn formatPaymentDate(gpa: Allocator, date_raw: []const u8) ![]u8 {
    const year_mark = std.mem.indexOf(u8, date_raw, "年") orelse return error.InvalidDate;
    const month_mark = std.mem.indexOf(u8, date_raw, "月") orelse return error.InvalidDate;
    if (month_mark <= year_mark) return error.InvalidDate;

    const year_part = date_raw[0..year_mark];
    const month_part = date_raw[(year_mark + "年".len)..month_mark];

    if (year_part.len != 4) return error.InvalidDate;
    if (month_part.len < 1 or month_part.len > 2) return error.InvalidDate;
    if (date_raw.len != month_mark + "月".len) return error.InvalidDate;
    if (!allDigits(year_part) or !allDigits(month_part)) return error.InvalidDate;

    const month_num = parseMonth(month_part) orelse return error.InvalidDate;
    if (month_num < 1 or month_num > 12) return error.InvalidDate;

    var out = try gpa.alloc(u8, 10);
    out[0] = @intCast('0' + (month_num / 10));
    out[1] = @intCast('0' + (month_num % 10));
    out[2] = '/';
    out[3] = '0';
    out[4] = '1';
    out[5] = '/';
    out[6] = year_part[0];
    out[7] = year_part[1];
    out[8] = year_part[2];
    out[9] = year_part[3];
    return out;
}

fn allDigits(value: []const u8) bool {
    for (value) |c| {
        if (c < '0' or c > '9') return false;
    }
    return true;
}

fn parseMonth(value: []const u8) ?u8 {
    if (value.len == 1) {
        return value[0] - '0';
    }
    return (value[0] - '0') * 10 + (value[1] - '0');
}

fn freeRecord(record: Record) void {
    if (record.date_raw) |v| allocator.free(v);
    if (record.category_raw) |v| allocator.free(v);
    if (record.hospital) |v| allocator.free(v);
    if (record.amount_raw) |v| allocator.free(v);
}

fn digitsOnly(gpa: Allocator, value: []const u8) ![]u8 {
    var buf = std.array_list.Managed(u8).init(gpa);
    for (value) |c| {
        if (c >= '0' and c <= '9') try buf.append(c);
    }
    return buf.toOwnedSlice();
}

fn contains(hay: []const u8, needle: []const u8) bool {
    return std.mem.indexOf(u8, hay, needle) != null;
}

fn writeField(out: *std.array_list.Managed(u8), value: []const u8) !void {
    const needs_quotes = std.mem.indexOfAny(u8, value, ",\"\n\r") != null;
    if (!needs_quotes) {
        try out.appendSlice(value);
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
}

fn parseCsvLine(gpa: Allocator, line: []const u8) ![]([]u8) {
    var fields = std.array_list.Managed([]u8).init(gpa);

    var i: usize = 0;
    while (i <= line.len) {
        var field = std.array_list.Managed(u8).init(gpa);
        var in_quotes = false;

        if (i < line.len and line[i] == '"') {
            in_quotes = true;
            i += 1;
        }

        while (i < line.len) {
            const c = line[i];
            if (in_quotes) {
                if (c == '"') {
                    if (i + 1 < line.len and line[i + 1] == '"') {
                        try field.append('"');
                        i += 2;
                        continue;
                    }
                    in_quotes = false;
                    i += 1;
                    continue;
                }
                try field.append(c);
                i += 1;
                continue;
            }

            if (c == ',') {
                i += 1;
                break;
            }
            try field.append(c);
            i += 1;
        }

        try fields.append(try field.toOwnedSlice());

        if (i >= line.len) break;
        if (i == line.len and line.len > 0 and line[line.len - 1] == ',') {
            try fields.append(try gpa.alloc(u8, 0));
            break;
        }
    }

    return fields.toOwnedSlice();
}

fn freeFields(gpa: Allocator, fields: []([]u8)) void {
    for (fields) |f| gpa.free(f);
    gpa.free(fields);
}
