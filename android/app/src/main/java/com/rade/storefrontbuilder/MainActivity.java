package com.rade.storefrontbuilder;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * The two things the web layer cannot do for itself inside a WebView.
 *
 * Both were found by using the app on a phone rather than by reading it.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().addJavascriptInterface(new FileHandoff(), "AndroidFiles");

        /*
         * Back closed the app from every screen, including Preview and Copy,
         * where a person means "step back to Build". Capacitor does not
         * intercept back at all, so the activity simply finished.
         *
         * The page leaves a history entry when it changes surface, so going
         * back in the WebView returns to the previous one. With no entries
         * left, which is the case on Build, this stands aside and the system
         * closes the app as it should.
         *
         * Registered on the dispatcher rather than overriding onBackPressed,
         * because that method is deprecated and is not called at all under
         * predictive back.
         */
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
            }
        });
    }

    /**
     * Handing a file to the person using the app.
     *
     * An anchor carrying a `download` attribute does nothing in a WebView, so
     * both export buttons produced no file at all while announcing that they
     * had. Searching the whole device afterwards found nothing, which is the
     * worst shape a failure can take on the one button that exists to rescue
     * someone's only copy of their page.
     *
     * The file is written into the app's own external directory, which needs no
     * permission on any supported version, and then offered through the
     * FileProvider already declared in the manifest. Android's own share sheet
     * decides where it ends up, which is the platform's answer to "save this
     * somewhere" and needs no dependency of ours.
     */
    private class FileHandoff {

        @JavascriptInterface
        public String save(String name, String mime, String text) {
            if (text == null) return "error: nothing to save";

            // The name reaches here from the page. Nothing but a plain file
            // name may survive, so no path can be built out of it.
            String safe = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safe.isEmpty() || safe.equals(".") || safe.equals("..")) safe = "page.txt";

            File file;
            try {
                File dir = new File(getExternalFilesDir(null), "exports");
                if (!dir.exists() && !dir.mkdirs()) return "error: the folder could not be created";
                file = new File(dir, safe);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                }
            } catch (Exception e) {
                return "error: " + e.getClass().getSimpleName();
            }

            // The file is on disk by this point, so the share sheet failing
            // later does not cost the artist their content. Posted to the main
            // thread because this method runs on a binder thread.
            final File written = file;
            final String type = mime == null ? "application/octet-stream" : mime;
            runOnUiThread(() -> {
                try {
                    Uri uri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        written
                    );
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(type);
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "Save " + written.getName()));
                } catch (Exception ignored) {
                    // The file is written and the page has already been told so.
                }
            });

            return "ok";
        }
    }
}
