package org.pulse2bp.demo;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.graphics.SurfaceTexture;
import android.hardware.Camera;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.*;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

@SuppressWarnings("deprecation")
public final class MainActivity extends Activity {
    private final Handler timer = new Handler(Looper.getMainLooper());
    private Camera camera;
    private SurfaceTexture texture;
    private EditText address;
    private TextView status, result;
    private Button button;
    private ProgressBar progress;
    private boolean busy;
    private int generation;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER_VERTICAL);
        page.setPadding(dp(28), dp(28), dp(28), dp(28));
        page.setBackgroundColor(Color.rgb(245, 249, 248));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(page);
        setContentView(scroll);

        page.addView(label("Pulse2BP", 38));
        page.addView(label("Rest your fingertip lightly over the rear camera and flash. Hold still for 30 seconds.", 17));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint("Computer address");
        address.setText(getPreferences(MODE_PRIVATE).getString("server", "http://127.0.0.1:8765"));
        page.addView(address);
        button = new Button(this);
        button.setText("Start capture");
        page.addView(button);
        button.setOnClickListener(view -> {
            if (busy) cancel();
            else if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
                requestPermissions(new String[] {Manifest.permission.CAMERA}, 1);
            else begin();
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(30);
        page.addView(progress);
        status = label("Ready", 16);
        result = label("", 34);
        page.addView(status);
        page.addView(result);
        page.addView(label("Research demo · Experimental estimate", 13));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private TextView label(String value, int size) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextColor(Color.rgb(16, 53, 50));
        text.setTextSize(size);
        text.setPadding(0, dp(8), 0, dp(8));
        return text;
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request == 1 && grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) begin();
        else status.setText("Allow camera access to capture your pulse.");
    }

    private void begin() {
        final URL endpoint;
        String server = address.getText().toString().trim().replaceAll("/+$", "");
        try {
            endpoint = new URL(server + "/estimate");
            if ((!endpoint.getProtocol().equals("http") && !endpoint.getProtocol().equals("https"))
                    || endpoint.getHost().isEmpty() || endpoint.getUserInfo() != null
                    || !endpoint.getPath().equals("/estimate") || endpoint.getQuery() != null
                    || endpoint.getRef() != null) throw new IllegalArgumentException();
        } catch (Exception error) {
            status.setText("Enter the computer address, including http:// and port 8765.");
            return;
        }
        getPreferences(MODE_PRIVATE).edit().putString("server", server).apply();
        busy = true;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        int run = ++generation;
        result.setText("");
        progress.setProgress(0);
        button.setText("Cancel");
        address.setEnabled(false);
        status.setText("Starting camera…");
        try {
            int rear = -1;
            Camera.CameraInfo info = new Camera.CameraInfo();
            for (int i = 0; i < Camera.getNumberOfCameras(); i++) {
                Camera.getCameraInfo(i, info);
                if (info.facing == Camera.CameraInfo.CAMERA_FACING_BACK) {
                    rear = i;
                    break;
                }
            }
            if (rear < 0) throw new IllegalStateException("A rear camera is required.");
            camera = Camera.open(rear);
            Camera.Parameters settings = camera.getParameters();
            List<String> flash = settings.getSupportedFlashModes();
            if (flash == null || !flash.contains(Camera.Parameters.FLASH_MODE_TORCH))
                throw new IllegalStateException("This camera does not support continuous flash.");
            settings.setFlashMode(Camera.Parameters.FLASH_MODE_TORCH);
            settings.setPreviewFormat(ImageFormat.NV21);
            Camera.Size size = settings.getPreviewSize();
            for (Camera.Size choice : settings.getSupportedPreviewSizes()) {
                if (Math.abs(choice.width - 640) < Math.abs(size.width - 640)) size = choice;
            }
            settings.setPreviewSize(size.width, size.height);
            camera.setParameters(settings);
            texture = new SurfaceTexture(0);
            camera.setPreviewTexture(texture);
            int width = size.width, height = size.height;
            long warmup = SystemClock.elapsedRealtimeNanos() + 2_000_000_000L;
            long[] first = {0};
            JSONArray times = new JSONArray(), values = new JSONArray();
            camera.setPreviewCallback((bytes, source) -> {
                long now = SystemClock.elapsedRealtimeNanos();
                if (run != generation || source != camera || now < warmup || bytes == null) return;
                if (first[0] == 0) {
                    first[0] = now;
                    Camera.Parameters exposure = source.getParameters();
                    if (exposure.isAutoExposureLockSupported()) {
                        try {
                            exposure.setAutoExposureLock(true);
                            source.setParameters(exposure);
                        } catch (RuntimeException ignored) {
                            // Some devices reject exposure changes during preview.
                        }
                    }
                }
                double elapsed = (now - first[0]) / 1e9;
                try {
                    times.put(elapsed);
                    values.put(redBrightness(bytes, width, height));
                } catch (Exception error) {
                    finish(run, "Camera data was incomplete. Try again.", "");
                    return;
                }
                status.setText("Hold still · " + Math.min(30, (int) elapsed) + " / 30 seconds");
                progress.setProgress((int) elapsed);
                if (elapsed >= 30) {
                    closeCamera();
                    status.setText("Estimating blood pressure…");
                    new Thread(() -> estimate(run, endpoint, times, values)).start();
                }
            });
            camera.startPreview();
            timer.postDelayed(() -> {
                if (camera != null && run == generation) finish(run, "Capture timed out. Try again.", "");
            }, 38_000);
        } catch (Exception error) {
            finish(run, error instanceof IllegalStateException ? error.getMessage() : "Could not start the camera.", "");
        }
    }

    private static double redBrightness(byte[] frame, int width, int height) {
        // NV21 stores luminance first and interleaves V and U after it.
        double sum = 0;
        int count = 0;
        for (int y = height / 4; y < 3 * height / 4; y += 8) {
            for (int x = width / 4; x < 3 * width / 4; x += 8) {
                int luma = frame[y * width + x] & 255;
                int chroma = frame[width * height + (y / 2) * width + (x & ~1)] & 255;
                double red = 1.164 * (luma - 16) + 1.596 * (chroma - 128);
                sum += Math.max(0, Math.min(255, red));
                count++;
            }
        }
        return sum / (255 * count);
    }

    private void estimate(int run, URL endpoint, JSONArray times, JSONArray values) {
        HttpURLConnection connection = null;
        try {
            JSONObject request = new JSONObject().put("seconds", times).put("brightness", values);
            byte[] body = request.toString().getBytes(StandardCharsets.UTF_8);
            connection = (HttpURLConnection) endpoint.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(12000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) { output.write(body); }
            boolean ok = connection.getResponseCode() == 200;
            InputStream stream = ok ? connection.getInputStream() : connection.getErrorStream();
            byte[] response;
            try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[2048];
                int length;
                while ((length = input.read(buffer)) != -1) {
                    if (output.size() + length > 16_384) throw new IllegalStateException("Response too large");
                    output.write(buffer, 0, length);
                }
                response = output.toByteArray();
            }
            JSONObject reply = new JSONObject(new String(response, StandardCharsets.UTF_8));
            String bp = ok ? reply.getInt("sbp") + " / " + reply.getInt("dbp") + " mmHg" : "";
            String message = ok ? "Estimated blood pressure" : reply.optString("error", "Capture could not be processed.");
            runOnUiThread(() -> finish(run, message, bp));
        } catch (Exception error) {
            runOnUiThread(() -> finish(run, "Could not reach Pulse2BP. Check the computer address and connection.", ""));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void closeCamera() {
        if (camera != null) {
            Camera active = camera;
            camera = null;
            try {
                active.setPreviewCallback(null);
                active.stopPreview();
            } catch (RuntimeException ignored) {
                // A failed camera startup may leave preview stopped.
            } finally {
                active.release();
            }
        }
        if (texture != null) {
            texture.release();
            texture = null;
        }
    }

    private void cancel() {
        generation++;
        finish(generation, "Capture stopped.", "");
    }

    private void finish(int run, String message, String bp) {
        if (run != generation) return;
        closeCamera();
        timer.removeCallbacksAndMessages(null);
        busy = false;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        address.setEnabled(true);
        button.setText("Start capture");
        status.setText(message);
        result.setText(bp);
    }

    @Override protected void onPause() {
        if (busy) cancel();
        super.onPause();
    }
}
