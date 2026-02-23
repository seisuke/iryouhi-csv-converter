const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});

    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const root_module = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = wasm_target,
        .optimize = optimize,
    });

    const exe = b.addExecutable(.{
        .name = "iryouhi",
        .root_module = root_module,
    });

    exe.entry = .disabled;
    exe.rdynamic = true;
    exe.root_module.strip = true;
    exe.root_module.single_threaded = true;
    exe.root_module.export_symbol_names = &[_][]const u8{
        "alloc",
        "dealloc",
        "convert",
        "last_output_len",
    };

    b.installArtifact(exe);

    const dist = b.addSystemCommand(&.{
        "sh",
        "-c",
        "cd web && bun install && bun --bun vite build && cp ../zig-out/bin/iryouhi.wasm ../dist/iryouhi.wasm",
    });
    dist.step.dependOn(&exe.step);

    const install_step = b.getInstallStep();
    install_step.dependOn(&dist.step);

    const serve = b.step("serve", "Serve dist/ over HTTP on localhost:8080");
    const serve_cmd = b.addSystemCommand(&.{
        "sh",
        "-c",
        "cd web && bun --bun vite preview --host",
    });
    serve_cmd.step.dependOn(install_step);
    serve.dependOn(&serve_cmd.step);
}
