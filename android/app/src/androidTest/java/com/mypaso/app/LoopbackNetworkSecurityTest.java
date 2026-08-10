package com.mypaso.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class LoopbackNetworkSecurityTest {

    @Test
    public void nativeJsonGateRequiresTheFixedChatRequestShape() {
        assertTrue(LoopbackAIHttpPlugin.encodeRequestBody(
            "{\"model\":\"test\",\"messages\":[]}"
        ).length > 0);
        assertFalse(LoopbackAIHttpPlugin.isValidChatRequestJson("[]"));
        assertFalse(LoopbackAIHttpPlugin.isValidChatRequestJson("{\"messages\":[]}"));
        assertFalse(LoopbackAIHttpPlugin.isValidChatRequestJson("not-json"));
        assertThrows(
            IllegalArgumentException.class,
            () -> LoopbackAIHttpPlugin.encodeRequestBody("[]")
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> LoopbackAIHttpPlugin.encodeRequestBody("not-json")
        );
    }

    @Test
    public void cleartextPolicyAllowsOnlyExactLoopbackHosts() {
        NetworkSecurityPolicy policy = NetworkSecurityPolicy.getInstance();

        assertTrue(policy.isCleartextTrafficPermitted("localhost"));
        assertTrue(policy.isCleartextTrafficPermitted("127.0.0.1"));
        assertTrue(policy.isCleartextTrafficPermitted("::1"));

        assertFalse(policy.isCleartextTrafficPermitted("localhost.evil"));
        assertFalse(policy.isCleartextTrafficPermitted("127.0.0.2"));
        assertFalse(policy.isCleartextTrafficPermitted("192.168.0.20"));
        assertFalse(policy.isCleartextTrafficPermitted("8.8.8.8"));
    }
}
