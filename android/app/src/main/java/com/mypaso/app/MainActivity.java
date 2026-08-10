package com.mypaso.app;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        EdgeToEdge.enable(this);
        registerPlugin(LoopbackAIHttpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
