package com.mypaso.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.nio.charset.StandardCharsets;
import org.junit.Test;

public class LoopbackAIHttpPluginTest {

    @Test
    public void acceptsOnlyCanonicalHttpLoopbackChatUrls() throws Exception {
        String[] allowed = {
            "http://localhost/v1/chat/completions",
            "http://localhost:8000/v1/chat/completions",
            "http://127.0.0.1:65535/v1/chat/completions",
            "http://[::1]:8000/v1/chat/completions"
        };

        for (String url : allowed) {
            assertEquals(url, LoopbackAIHttpPlugin.validateRequestUrl(url).toExternalForm());
        }
    }

    @Test
    public void rejectsEveryNonCanonicalOrOffPolicyTarget() {
        String[] rejected = {
            "https://127.0.0.1:8000/v1/chat/completions",
            "http://192.168.0.20:8000/v1/chat/completions",
            "http://8.8.8.8:8000/v1/chat/completions",
            "http://127.0.0.2:8000/v1/chat/completions",
            "http://2130706433:8000/v1/chat/completions",
            "http://localhost.evil:8000/v1/chat/completions",
            "http://LOCALHOST:8000/v1/chat/completions",
            "HTTP://localhost:8000/v1/chat/completions",
            "http://user@localhost:8000/v1/chat/completions",
            "http://localhost:8000/v1/models",
            "http://localhost:8000/v1/chat/completions?token=x",
            "http://localhost:8000/v1/chat/completions#fragment",
            "http://localhost:0/v1/chat/completions",
            "http://localhost:08000/v1/chat/completions",
            "http://localhost:65536/v1/chat/completions",
            "http://[0:0:0:0:0:0:0:1]:8000/v1/chat/completions"
        };

        for (String url : rejected) {
            assertThrows(IllegalArgumentException.class, () -> LoopbackAIHttpPlugin.validateRequestUrl(url));
        }
    }

    @Test
    public void validatesBoundedRequestBodiesByUtf8Bytes() {
        assertArrayEquals(
            "{\"model\":\"test\",\"messages\":[]}".getBytes(StandardCharsets.UTF_8),
            LoopbackAIHttpPlugin.encodeBoundedRequestBody("{\"model\":\"test\",\"messages\":[]}")
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> LoopbackAIHttpPlugin.encodeBoundedRequestBody("x".repeat(LoopbackAIHttpPlugin.MAX_REQUEST_BODY_BYTES + 1))
        );
    }

    @Test
    public void configuresAFixedJsonPostThatNeverFollowsRedirects() throws Exception {
        FakeConnection connection = new FakeConnection();

        LoopbackAIHttpPlugin.configureConnection(connection, 2);

        assertEquals("POST", connection.getRequestMethod());
        assertFalse(connection.getInstanceFollowRedirects());
        assertEquals(LoopbackAIHttpPlugin.NETWORK_TIMEOUT_MS, connection.getConnectTimeout());
        assertEquals(LoopbackAIHttpPlugin.NETWORK_TIMEOUT_MS, connection.getReadTimeout());
        assertEquals("application/json", connection.getRequestProperty("Content-Type"));
        assertEquals("application/json", connection.getRequestProperty("Accept"));
        assertTrue(connection.getDoInput());
        assertTrue(connection.getDoOutput());
    }

    @Test
    public void opensTheValidatedLoopbackUrlWithoutAnySystemProxy() throws Exception {
        RecordingUrlHandler handler = new RecordingUrlHandler();
        URL url = new URL(
            null,
            "http://127.0.0.1:8000/v1/chat/completions",
            handler
        );

        HttpURLConnection connection = LoopbackAIHttpPlugin.openLoopbackConnection(url);

        assertSame(handler.connection, connection);
        assertSame(Proxy.NO_PROXY, handler.proxy);
    }

    @Test
    public void capsResponseBytesBeforeDecoding() throws Exception {
        byte[] accepted = "x".repeat(LoopbackAIHttpPlugin.MAX_RESPONSE_BODY_BYTES).getBytes(StandardCharsets.UTF_8);
        assertArrayEquals(
            accepted,
            LoopbackAIHttpPlugin.readBoundedResponse(new ByteArrayInputStream(accepted))
        );

        byte[] rejected = "x".repeat(LoopbackAIHttpPlugin.MAX_RESPONSE_BODY_BYTES + 1).getBytes(StandardCharsets.UTF_8);
        assertThrows(
            LoopbackAIHttpPlugin.ResponseTooLargeException.class,
            () -> LoopbackAIHttpPlugin.readBoundedResponse(new ByteArrayInputStream(rejected))
        );
    }

    @Test
    public void acceptsOnlyBoundedOpaqueRequestIds() {
        assertTrue(LoopbackAIHttpPlugin.isValidRequestId("paso-ai-localsequence-1"));
        assertFalse(LoopbackAIHttpPlugin.isValidRequestId(""));
        assertFalse(LoopbackAIHttpPlugin.isValidRequestId("../request"));
        assertFalse(LoopbackAIHttpPlugin.isValidRequestId("x".repeat(129)));
    }

    @Test
    public void cancellationDisconnectsTheExactActiveConnection() throws Exception {
        LoopbackAIHttpPlugin.RequestState state = new LoopbackAIHttpPlugin.RequestState();
        FakeConnection connection = new FakeConnection();

        assertTrue(state.attachConnection(connection));
        assertTrue(state.cancel());
        assertTrue(state.isCancelled());
        assertTrue(connection.disconnected);
        assertFalse(state.cancel());
    }

    @Test
    public void aConnectionCannotAttachAfterCancellation() throws Exception {
        LoopbackAIHttpPlugin.RequestState state = new LoopbackAIHttpPlugin.RequestState();
        FakeConnection connection = new FakeConnection();

        state.cancel();

        assertFalse(state.attachConnection(connection));
        assertTrue(connection.disconnected);
    }

    private static final class FakeConnection extends HttpURLConnection {
        private boolean disconnected;

        private FakeConnection() throws Exception {
            super(new URL("http://127.0.0.1:8000/v1/chat/completions"));
        }

        @Override
        public void disconnect() {
            disconnected = true;
        }

        @Override
        public boolean usingProxy() {
            return false;
        }

        @Override
        public void connect() {}
    }

    private static final class RecordingUrlHandler extends URLStreamHandler {
        private final FakeConnection connection;
        private Proxy proxy;

        private RecordingUrlHandler() throws Exception {
            connection = new FakeConnection();
        }

        @Override
        protected URLConnection openConnection(URL url) {
            throw new AssertionError("Proxy-aware openConnection must be used");
        }

        @Override
        protected URLConnection openConnection(URL url, Proxy selectedProxy) {
            proxy = selectedProxy;
            return connection;
        }
    }
}
