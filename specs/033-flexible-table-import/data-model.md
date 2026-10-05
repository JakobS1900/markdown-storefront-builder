# Data model

The persisted Document, IndexedDB schema and exported backup shape are unchanged. Local asset records still hold normalized raster bytes and MIME. Any detected MIME is transient input validation metadata.

Import table data remains transient: headers, data rows with absolute one-based physical source lines, plus explicit furniture line numbers where needed. Source spans retain original LF-normalized text and zero-based inclusive offsets. Correction row keys remain section index, source line and tier index. Never derive identity from decoded cell text.
