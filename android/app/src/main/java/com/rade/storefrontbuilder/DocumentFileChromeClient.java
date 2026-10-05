package com.rade.storefrontbuilder;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.Arrays;
import java.util.Locale;

final class DocumentFileChromeClient extends BridgeWebChromeClient {
    private final ActivityResultLauncher<Intent> documents;
    private ValueCallback<Uri[]> pending;

    DocumentFileChromeClient(Bridge bridge) {
        super(bridge);
        documents = bridge.registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            ValueCallback<Uri[]> callback = pending;
            pending = null;
            if (callback != null) {
                callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(
                    result.getResultCode(), result.getData()
                ));
            }
        });
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
        String types = Arrays.toString(params.getAcceptTypes()).toLowerCase(Locale.ROOT);
        boolean images = types.contains("image/");
        if (params.isCaptureEnabled() || !(images || types.contains("text/") || types.contains(".txt") ||
            types.contains(".md") || types.contains(".csv") || types.contains(".tsv") ||
            types.contains(".json") || types.contains("application/json"))) {
            return super.onShowFileChooser(webView, callback, params);
        }

        if (pending != null) pending.onReceiveValue(null);
        pending = callback;
        // Providers may report Markdown as a generic MIME type. The web import controls check the chosen name.
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(images ? "image/*" : "*/*")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            documents.launch(intent);
        } catch (ActivityNotFoundException e) {
            pending = null;
            return super.onShowFileChooser(webView, callback, params);
        }
        return true;
    }
}
