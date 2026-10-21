using System.IO.Compression;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Xml.Linq;

internal static class PackageInspector
{
    // First release intentionally accepts managed, dependency-free packages only.
    // Never execute package install scripts, analyzers, MSBuild targets or native assets.
    internal static object Install(string archive, string destination, string id, string version)
    {
        using var zip = ZipFile.OpenRead(archive);
        if (zip.Entries.Count > 5000 || zip.Entries.Sum(e => e.Length) > 100_000_000)
            throw new InvalidOperationException("Пакет слишком большой.");
        if (zip.Entries.Any(e => e.FullName.StartsWith("build", StringComparison.OrdinalIgnoreCase) || e.FullName.StartsWith("runtimes/", StringComparison.OrdinalIgnoreCase) || e.FullName.StartsWith("analyzers/", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Пакеты с native assets, анализаторами или MSBuild targets пока не поддерживаются.");
        var specEntry = zip.Entries.Single(e => !e.FullName.Contains('/') && e.FullName.EndsWith(".nuspec"));
        using var specStream = specEntry.Open();
        var spec = XDocument.Load(specStream);
        var metadata = spec.Root!.Elements().Single(e => e.Name.LocalName == "metadata");
        string Property(string name) => metadata.Elements().FirstOrDefault(e => e.Name.LocalName == name)?.Value ?? "";
        if (!string.Equals(Property("id"), id, StringComparison.OrdinalIgnoreCase) || !string.Equals(Property("version"), version, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Идентификатор или версия пакета не совпадают.");
        string[] targets = ["net10.0", "net9.0", "net8.0", "net7.0", "net6.0", "net5.0", "netstandard2.1", "netstandard2.0"];
        var target = targets.FirstOrDefault(t => zip.Entries.Any(e => e.FullName.StartsWith($"lib/{t}/") && e.FullName.EndsWith(".dll")))
            ?? throw new InvalidOperationException("Нет совместимой .NET / .NET Standard сборки для Mac runtime.");
        string Canonical(string name) => name.Replace(".NETStandard", "netstandard").Replace(".NETCoreApp", "net").ToLowerInvariant();
        var dependencies = metadata.Elements().FirstOrDefault(e => e.Name.LocalName == "dependencies");
        var groups = dependencies?.Elements().Where(e => e.Name.LocalName == "group").ToArray() ?? [];
        var group = groups.FirstOrDefault(e => Canonical((string?)e.Attribute("targetFramework") ?? "") == target)
            ?? groups.FirstOrDefault(e => string.IsNullOrEmpty((string?)e.Attribute("targetFramework")));
        if (dependencies?.Elements().Any(e => e.Name.LocalName == "dependency") == true ||
            group?.Elements().Any(e => e.Name.LocalName == "dependency") == true || groups.Length > 0 && group is null)
            throw new InvalidOperationException("В первой версии доступны пакеты без внешних зависимостей. Этот пакет требует восстановления зависимостей.");
        var entries = zip.Entries.Where(e => e.FullName.StartsWith($"lib/{target}/") && e.FullName.EndsWith(".dll") && e.FullName.Split('/').Length == 3).ToArray();
        var framework = Directory.GetFiles(Path.GetDirectoryName(typeof(object).Assembly.Location)!, "*.dll")
            .Select(Path.GetFileNameWithoutExtension).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var binaries = new Dictionary<string, byte[]>();
        foreach (var entry in entries)
        {
            var name = Path.GetFileName(entry.FullName);
            if (entry.Length > 30_000_000 || !System.Text.RegularExpressions.Regex.IsMatch(name, @"^[A-Za-z0-9_.-]+\.dll$")) throw new InvalidOperationException("Некорректная сборка пакета.");
            using var stream = entry.Open(); using var bytes = new MemoryStream(); stream.CopyTo(bytes);
            using var pe = new PEReader(new MemoryStream(bytes.ToArray()));
            if (!pe.HasMetadata || pe.PEHeaders.CorHeader is not { } header || !header.Flags.HasFlag(CorFlags.ILOnly))
                throw new InvalidOperationException("Поддерживаются только managed .NET сборки.");
            var reader = pe.GetMetadataReader();
            var assemblyName = reader.GetString(reader.GetAssemblyDefinition().Name);
            if (framework.Contains(assemblyName) || assemblyName.StartsWith("Studio", StringComparison.OrdinalIgnoreCase) || !names.Add(assemblyName) || assemblyName + ".dll" != name)
                throw new InvalidOperationException("Конфликт имён сборок пакета.");
            binaries.Add(name, bytes.ToArray());
        }
        foreach (var bytes in binaries.Values)
        {
            using var pe = new PEReader(new MemoryStream(bytes)); var reader = pe.GetMetadataReader();
            foreach (var handle in reader.AssemblyReferences)
            {
                var name = reader.GetString(reader.GetAssemblyReference(handle).Name);
                if (!framework.Contains(name) && !names.Contains(name)) throw new InvalidOperationException($"Пакет требует неподдерживаемую зависимость: {name}.");
            }
        }
        Directory.CreateDirectory(destination);
        var hashes = new Dictionary<string, string>();
        foreach (var (name, bytes) in binaries) { File.WriteAllBytes(Path.Combine(destination, name), bytes); hashes[name] = Convert.ToHexString(SHA256.HashData(bytes)); }
        // Keep the original archive (including package license/notices) alongside DLLs.
        File.Copy(archive, Path.Combine(destination, "package.nupkg"), overwrite: true);
        var manifest = new { id, version, target, hashes };
        File.WriteAllText(Path.Combine(destination, "manifest.json"), System.Text.Json.JsonSerializer.Serialize(manifest));
        return manifest;
    }
}
