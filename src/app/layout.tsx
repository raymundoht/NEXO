import type { Metadata } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NEXO",
    template: "%s | NEXO"
  },
  description: "Sistema integral de inventarios, compras y punto de venta.",
  icons: {
    icon: "/logo-blue.png",
    shortcut: "/logo-blue.png",
    apple: "/logo-blue.png"
  },
  robots: { index: false, follow: false }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("nexo-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.setAttribute("data-theme","dark");}else{document.documentElement.setAttribute("data-theme","light");}}catch(e){}try{var a=JSON.parse(localStorage.getItem("nexo-appearance")||"{}");var isDark=document.documentElement.getAttribute("data-theme")==="dark";var accent=isDark&&(a.accentColorDark)?a.accentColorDark:(a.accentColor||"#2563eb");var r=document.documentElement.style;r.setProperty("--color-accent",accent);r.setProperty("--color-primary-soft","rgba("+parseInt(accent.slice(1,3),16)+","+parseInt(accent.slice(3,5),16)+","+parseInt(accent.slice(5,7),16)+",0.12)");r.setProperty("--color-focus","rgba("+parseInt(accent.slice(1,3),16)+","+parseInt(accent.slice(3,5),16)+","+parseInt(accent.slice(5,7),16)+",0.18)");if(a.borderRadius){var R={"none":{"6":"0px","8":"0px","12":"0px","16":"0px","24":"0px"},"sm":{"6":"4px","8":"6px","12":"8px","16":"10px","24":"14px"},"md":{"6":"6px","8":"8px","12":"12px","16":"16px","24":"24px"},"lg":{"6":"8px","8":"12px","12":"16px","16":"24px","24":"32px"},"xl":{"6":"12px","8":"16px","12":"24px","16":"32px","24":"48px"}};var rv=R[a.borderRadius]||R.md;r.setProperty("--radius-xs",rv["6"]);r.setProperty("--radius-sm",rv["8"]);r.setProperty("--radius-md",rv["12"]);r.setProperty("--radius-lg",rv["16"]);r.setProperty("--radius-xl",rv["24"]);}if(a.fontSize){var F={"xs":{"12":"11px","14":"13px","16":"15px","20":"17px"},"sm":{"12":"12px","14":"14px","16":"16px","20":"20px"},"md":{"12":"13px","14":"15px","16":"17px","20":"22px"},"lg":{"12":"14px","14":"16px","16":"18px","20":"24px"}};var fv=F[a.fontSize]||F.sm;r.setProperty("--text-xs",fv["12"]);r.setProperty("--text-sm",fv["14"]);r.setProperty("--text-md",fv["16"]);r.setProperty("--text-lg",fv["20"]);}if(a.fontFamily){var ff={"poppins":'"Poppins","Inter",ui-sans-serif,system-ui,sans-serif',"inter":'"Inter","Poppins",ui-sans-serif,system-ui,sans-serif',"roboto":'"Roboto","Inter",ui-sans-serif,system-ui,sans-serif',"nunito":'"Nunito","Inter",ui-sans-serif,system-ui,sans-serif'};r.setProperty("--font-sans",ff[a.fontFamily]||ff.poppins);}if(a.density){var D={"compact":{"10":"10px","12":"12px"},"normal":{"10":"16px","12":"16px"},"comfortable":{"10":"22px","12":"20px"}};var dv=D[a.density]||D.normal;r.setProperty("--density-gap",dv["10"]);r.setProperty("--density-padding",dv["12"]);}if(a.sidebarStyle){var sb=a.sidebarStyle==="brand"?(isDark&&a.accentColorDark?a.accentColorDark:a.accentColor||"#2563eb"):a.sidebarStyle==="light"?"#ffffff":"#0f172a";r.setProperty("--sidebar",sb);}}catch(e){}})();`
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
