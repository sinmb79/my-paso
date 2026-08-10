package com.mypaso.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Proxy;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "LoopbackAIHttp")
public class LoopbackAIHttpPlugin extends Plugin {

    static final int MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;
    static final int MAX_RESPONSE_BODY_BYTES = 32 * 1024;
    static final int NETWORK_TIMEOUT_MS = 45_000;

    private static final String CHAT_PATH = "/v1/chat/completions";
    private static final Pattern SAFE_URL = Pattern.compile(
        "^http://(localhost|127\\.0\\.0\\.1|\\[::1\\])(?::([1-9][0-9]{0,4}))?/v1/chat/completions$"
    );
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("^paso-ai-[a-z0-9-]{1,112}$");

    private final Map<String, RequestState> activeRequests = new ConcurrentHashMap<>();
    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(
        2,
        2,
        0L,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(4),
        new ThreadPoolExecutor.AbortPolicy()
    );

    @PluginMethod
    public void post(PluginCall call) {
        String requestId = call.getString("requestId");
        String rawUrl = call.getString("url");
        String rawBody = call.getString("body");

        if (!isValidRequestId(requestId)) {
            rejectInvalid(call);
            return;
        }

        final URL url;
        final byte[] requestBody;
        try {
            url = validateRequestUrl(rawUrl);
            requestBody = encodeRequestBody(rawBody);
        } catch (IllegalArgumentException exception) {
            rejectInvalid(call);
            return;
        }

        RequestState state = new RequestState();
        if (activeRequests.putIfAbsent(requestId, state) != null) {
            call.reject("Loopback AI request ID is already active.", "DUPLICATE_REQUEST");
            return;
        }

        try {
            executor.execute(() -> executeRequest(call, requestId, state, url, requestBody));
        } catch (RejectedExecutionException exception) {
            activeRequests.remove(requestId, state);
            call.reject("Loopback AI transport is busy.", "TRANSPORT_BUSY");
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String requestId = call.getString("requestId");
        if (!isValidRequestId(requestId)) {
            rejectInvalid(call);
            return;
        }

        RequestState state = activeRequests.get(requestId);
        boolean cancelled = state != null && state.cancel();
        JSObject result = new JSObject();
        result.put("cancelled", cancelled);
        call.resolve(result);
    }

    private void executeRequest(
        PluginCall call,
        String requestId,
        RequestState state,
        URL url,
        byte[] requestBody
    ) {
        HttpURLConnection connection = null;
        try {
            if (state.isCancelled()) {
                rejectCancelled(call);
                return;
            }

            connection = openLoopbackConnection(url);
            if (!state.attachConnection(connection)) {
                rejectCancelled(call);
                return;
            }

            configureConnection(connection, requestBody.length);

            try (OutputStream output = connection.getOutputStream()) {
                output.write(requestBody);
            }

            if (state.isCancelled()) {
                rejectCancelled(call);
                return;
            }

            int status = connection.getResponseCode();
            if (status < 100 || status > 599) {
                throw new IOException("Invalid HTTP status");
            }
            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > MAX_RESPONSE_BODY_BYTES) {
                throw new ResponseTooLargeException();
            }

            byte[] responseBody;
            InputStream responseStream = status >= 400
                ? connection.getErrorStream()
                : connection.getInputStream();
            if (responseStream == null) {
                responseBody = new byte[0];
            } else {
                try (InputStream input = responseStream) {
                    responseBody = readBoundedResponse(input);
                }
            }

            if (state.isCancelled()) {
                rejectCancelled(call);
                return;
            }

            JSObject result = new JSObject();
            result.put("status", status);
            result.put("body", new String(responseBody, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (ResponseTooLargeException exception) {
            call.reject("Loopback AI response body is too large.", "RESPONSE_TOO_LARGE");
        } catch (SocketTimeoutException exception) {
            call.reject("Loopback AI request timed out.", "TIMEOUT");
        } catch (IOException | RuntimeException exception) {
            if (state.isCancelled()) {
                rejectCancelled(call);
            } else {
                call.reject("Loopback AI network request failed.", "NETWORK_ERROR");
            }
        } finally {
            if (connection != null) {
                state.detachConnection(connection);
                connection.disconnect();
            }
            activeRequests.remove(requestId, state);
        }
    }

    private static void rejectInvalid(PluginCall call) {
        call.reject("Loopback AI request was invalid.", "INVALID_REQUEST");
    }

    private static void rejectCancelled(PluginCall call) {
        call.reject("Loopback AI request was cancelled.", "CANCELLED");
    }

    static boolean isValidRequestId(String requestId) {
        return requestId != null && SAFE_REQUEST_ID.matcher(requestId).matches();
    }

    static URL validateRequestUrl(String rawUrl) {
        if (rawUrl == null || !rawUrl.equals(rawUrl.trim())) {
            throw new IllegalArgumentException("Invalid URL");
        }

        Matcher match = SAFE_URL.matcher(rawUrl);
        if (!match.matches()) {
            throw new IllegalArgumentException("URL is outside the loopback policy");
        }
        String rawPort = match.group(2);
        if (rawPort != null && Integer.parseInt(rawPort) > 65_535) {
            throw new IllegalArgumentException("Invalid port");
        }

        try {
            URI uri = new URI(rawUrl);
            if (
                !"http".equals(uri.getScheme()) ||
                uri.getRawUserInfo() != null ||
                !CHAT_PATH.equals(uri.getRawPath()) ||
                uri.getRawQuery() != null ||
                uri.getRawFragment() != null
            ) {
                throw new IllegalArgumentException("URL is outside the loopback policy");
            }
            return uri.toURL();
        } catch (URISyntaxException | IOException exception) {
            throw new IllegalArgumentException("Invalid URL");
        }
    }

    static void configureConnection(HttpURLConnection connection, int requestBodyLength) throws IOException {
        connection.setRequestMethod("POST");
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(NETWORK_TIMEOUT_MS);
        connection.setReadTimeout(NETWORK_TIMEOUT_MS);
        connection.setUseCaches(false);
        connection.setAllowUserInteraction(false);
        connection.setDoInput(true);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        connection.setFixedLengthStreamingMode(requestBodyLength);
    }

    static HttpURLConnection openLoopbackConnection(URL url) throws IOException {
        return (HttpURLConnection) url.openConnection(Proxy.NO_PROXY);
    }

    static byte[] encodeRequestBody(String rawBody) {
        byte[] bytes = encodeBoundedRequestBody(rawBody);
        if (!isValidChatRequestJson(rawBody)) {
            throw new IllegalArgumentException("Invalid chat request JSON");
        }
        return bytes;
    }

    static byte[] encodeBoundedRequestBody(String rawBody) {
        if (rawBody == null || rawBody.isEmpty()) {
            throw new IllegalArgumentException("Missing JSON body");
        }
        ensureBoundedUtf8(rawBody, MAX_REQUEST_BODY_BYTES);
        byte[] bytes = rawBody.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_REQUEST_BODY_BYTES) {
            throw new IllegalArgumentException("Request body is too large");
        }
        return bytes;
    }

    static boolean isValidChatRequestJson(String rawBody) {
        try {
            JSONObject json = new JSONObject(rawBody);
            Object model = json.opt("model");
            Object messages = json.opt("messages");
            return model instanceof String && !((String) model).isEmpty() && messages instanceof JSONArray;
        } catch (JSONException exception) {
            return false;
        }
    }

    private static void ensureBoundedUtf8(String value, int maximumBytes) {
        int byteCount = 0;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character <= 0x7f) {
                byteCount += 1;
            } else if (character <= 0x7ff) {
                byteCount += 2;
            } else if (
                Character.isHighSurrogate(character) &&
                index + 1 < value.length() &&
                Character.isLowSurrogate(value.charAt(index + 1))
            ) {
                byteCount += 4;
                index += 1;
            } else {
                byteCount += 3;
            }
            if (byteCount > maximumBytes) {
                throw new IllegalArgumentException("UTF-8 payload is too large");
            }
        }
    }

    static byte[] readBoundedResponse(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        while (true) {
            int remaining = MAX_RESPONSE_BODY_BYTES - output.size();
            int read = input.read(buffer, 0, Math.min(buffer.length, remaining + 1));
            if (read == -1) {
                return output.toByteArray();
            }
            if (read > remaining) {
                throw new ResponseTooLargeException();
            }
            output.write(buffer, 0, read);
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (RequestState state : activeRequests.values()) {
            state.cancel();
        }
        activeRequests.clear();
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    static final class RequestState {

        private boolean cancelled;
        private HttpURLConnection connection;

        synchronized boolean attachConnection(HttpURLConnection nextConnection) {
            if (cancelled) {
                nextConnection.disconnect();
                return false;
            }
            connection = nextConnection;
            return true;
        }

        synchronized void detachConnection(HttpURLConnection currentConnection) {
            if (connection == currentConnection) {
                connection = null;
            }
        }

        synchronized boolean cancel() {
            if (cancelled) {
                return false;
            }
            cancelled = true;
            if (connection != null) {
                connection.disconnect();
            }
            return true;
        }

        synchronized boolean isCancelled() {
            return cancelled;
        }
    }

    static final class ResponseTooLargeException extends IOException {}
}
