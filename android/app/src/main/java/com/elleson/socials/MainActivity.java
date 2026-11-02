package com.elleson.socials;

import android.os.Bundle;
import android.content.ActivityNotFoundException;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import com.getcapacitor.BridgeActivity;
import java.net.URI;

public class MainActivity extends BridgeActivity {
    private ScrollView workspaceScreen;
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setPadding(0,dp(9),0,dp(9));return t;}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        final int green=Color.rgb(22,75,61),muted=Color.rgb(108,125,115);
        workspaceScreen=new ScrollView(this);workspaceScreen.setFillViewport(true);workspaceScreen.setBackgroundColor(Color.rgb(243,246,241));
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(dp(28),dp(60),dp(28),dp(28));layout.setGravity(Gravity.CENTER_VERTICAL);workspaceScreen.addView(layout);
        TextView brand=text("e•",54,green);brand.setTypeface(Typeface.DEFAULT,Typeface.BOLD);layout.addView(brand);
        TextView heading=text("Your socials.\nOne workspace.",32,green);heading.setTypeface(Typeface.DEFAULT,Typeface.BOLD);layout.addView(heading);
        layout.addView(text("Connect to the same server you use in Elleson Connect.",15,muted));
        layout.addView(text("Server address",13,green));
        EditText server=new EditText(this);server.setSingleLine(true);server.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);server.setTextSize(15);server.setPadding(dp(15),dp(15),dp(15),dp(15));server.setText(getPreferences(MODE_PRIVATE).getString("workspace_server","https://remote.teamtrader.co.za"));server.setHint("https://your-server.example");server.setSelectAllOnFocus(true);server.setContentDescription("Connect server address");GradientDrawable field=new GradientDrawable();field.setColor(Color.WHITE);field.setCornerRadius(dp(10));field.setStroke(dp(1),Color.rgb(216,227,216));server.setBackground(field);layout.addView(server,new LinearLayout.LayoutParams(-1,dp(58)));
        TextView error=text("",13,Color.rgb(163,77,55));layout.addView(error);
        Button open=new Button(this);open.setText("Open my workspace");open.setTextSize(15);open.setTextColor(Color.WHITE);open.setAllCaps(false);GradientDrawable shape=new GradientDrawable();shape.setColor(green);shape.setCornerRadius(dp(11));open.setBackground(shape);layout.addView(open,new LinearLayout.LayoutParams(-1,dp(54)));
        open.setOnClickListener(view->{
            try{
                String origin=serverOrigin(server.getText().toString().trim());
                if(origin==null){error.setText("Use an HTTPS server address, or your PC’s local Wi-Fi address and port.");return;}
                getPreferences(MODE_PRIVATE).edit().putString("workspace_server",origin).apply();error.setText("");
                CustomTabsIntent tab=new CustomTabsIntent.Builder().setShowTitle(true).setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(green).build()).build();
                tab.launchUrl(this,Uri.parse(origin+"/?project=socials"));
            }catch(ActivityNotFoundException ex){error.setText("Install or enable a browser to sign in to your workspace.");}
        });
        layout.addView(text("Sign in with your Connect account. Posts, files and activity stay on the server.",13,muted));
        TextView local=text("Local Wi-Fi: enter your PC address, for example http://192.168.8.100:7666",12,muted);layout.addView(local);
        Button recover=new Button(this);recover.setText("Recover older device posts");recover.setAllCaps(false);recover.setTextColor(green);recover.setBackgroundColor(Color.TRANSPARENT);recover.setOnClickListener(view->workspaceScreen.setVisibility(View.GONE));layout.addView(recover);
        addContentView(workspaceScreen,new FrameLayout.LayoutParams(-1,-1));
    }
    private String serverOrigin(String value){
        try{
            URI uri=new URI(value);String scheme=uri.getScheme(),host=uri.getHost(),path=uri.getPath();int port=uri.getPort();
            if(host==null||uri.getRawUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||port==0||port>65535)return null;
            if(path!=null&&!path.isEmpty()&&!path.equals("/")&&!path.equals("/socials")&&!path.equals("/socials/"))return null;
            boolean local=false;
            if(host.matches("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+")){String[] parts=host.split("\\.");int[] n=new int[4];for(int i=0;i<4;i++){n[i]=Integer.parseInt(parts[i]);if(n[i]<0||n[i]>255)return null;}local=n[0]==10||n[0]==192&&n[1]==168||n[0]==172&&n[1]>=16&&n[1]<=31;}
            if(!"https".equals(scheme)&&!("http".equals(scheme)&&local))return null;
            return new URI(scheme,null,host,port,null,null,null).toString();
        }catch(Exception ex){return null;}
    }
    @Override public void onBackPressed(){if(workspaceScreen!=null&&workspaceScreen.getVisibility()!=View.VISIBLE){workspaceScreen.setVisibility(View.VISIBLE);return;}super.onBackPressed();}
}
