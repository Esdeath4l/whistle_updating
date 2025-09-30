import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QrCode, Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeGeneratorProps {
  reportUrl?: string;
}

export default function QRCodeGenerator({ reportUrl }: QRCodeGeneratorProps) {
  const [showQR, setShowQR] = useState(false);
  const currentUrl = reportUrl || `${window.location.origin}/report`;

  const downloadQR = () => {
    const svg = document.getElementById("qr-code") as unknown as SVGElement | null;
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      canvas.width = 200;
      canvas.height = 200;

      img.onload = () => {
        ctx?.drawImage(img, 0, 0);
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = "whistle-report-qr.png";
        link.href = url;
        link.click();
      };

      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    }
  };

  const printQR = () => {
    const svg = document.getElementById("qr-code") as unknown as SVGElement | null;
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Whistle QR Code</title>
              <style>
                body {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  font-family: Arial, sans-serif;
                  padding: 20px;
                }
                .header { text-align: center; margin-bottom: 20px; }
                .qr-container { text-align: center; }
                .instructions { margin-top: 20px; max-width: 400px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>🔒 Whistle</h1>
                <h2>Anonymous Reporting</h2>
                <p><strong>Speak up safely. Stay anonymous.</strong></p>
              </div>
              <div class="qr-container">
                ${svgData}
              </div>
              <div class="instructions">
                <h3>How to Report:</h3>
                <ol>
                  <li>Scan this QR code with your phone</li>
                  <li>Fill out the anonymous form</li>
                  <li>Submit your report securely</li>
                  <li>Get a tracking ID for status updates</li>
                </ol>
                <p><em>Your privacy is completely protected. No personal information is collected.</em></p>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <Dialog open={showQR} onOpenChange={setShowQR}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="w-4 h-4 mr-2" />
          Generate QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for Anonymous Reporting</DialogTitle>
          <DialogDescription>
            Scan this code to quickly access the reporting form
          </DialogDescription>
        </DialogHeader>

        <Card className="border-0">
          <CardContent className="pt-6 text-center">
            <div className="bg-white p-4 rounded-lg inline-block mb-4">
              <QRCodeSVG
                id="qr-code"
                value={currentUrl}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this QR code at your event for easy access
              </p>

              <div className="flex gap-2 justify-center">
                <Button onClick={downloadQR} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button onClick={printQR} variant="outline" size="sm">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Poster
                </Button>
              </div>

              <div className="text-xs text-muted-foreground mt-4 space-y-1">
                <p>
                  🔒 <strong>100% Anonymous</strong>
                </p>
                <p>
                  📱 <strong>Mobile Optimized</strong>
                </p>
                <p>
                  ⚡ <strong>Real-time Admin Alerts</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
