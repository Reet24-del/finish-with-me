/// Deterministic lexical hash for precedent search.
/// Words and character 3-grams are bucketed into 256 dimensions and L2-normalised.
/// This is not a semantic embedding model. It does not download a model and it does not use an API key.
/// The same text always returns the same comma-separated vector.
Class Finish.Memory.Embed Extends %RegisteredObject
{

ClassMethod Vector(text As %String(MAXLEN = 32000)) As %String(MAXLEN = 8000) [ Language = python ]
{
    import math
    import re

    dims = 256
    if text is None:
        raw = ""
    elif isinstance(text, str):
        raw = text
    else:
        raw = str(text)
    lowered = raw.lower()
    words = re.findall(r"[a-z0-9]+", lowered)
    compact = re.sub(r"[^a-z0-9]+", " ", lowered).strip()
    padded = " " + compact + " "
    grams = [padded[i:i + 3] for i in range(max(len(padded) - 2, 0))]
    if not words and not grams:
        words = ["empty"]
    vec = [0.0] * dims
    for token, weight in [(word, 2.0) for word in words] + [(gram, 1.0) for gram in grams]:
        acc = 2166136261
        for ch in token:
            acc ^= ord(ch)
            acc = (acc * 16777619) & 0xFFFFFFFF
        vec[acc % dims] += weight if (acc & 1) == 0 else -weight
    norm = math.sqrt(sum(value * value for value in vec))
    if norm == 0.0:
        vec[0] = 1.0
        norm = 1.0
    return ",".join(format(value / norm, ".8f") for value in vec)
}

}
