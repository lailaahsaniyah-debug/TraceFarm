
import QRCode from 'qrcode'

export async function generateQR(value) {
  if (!value || !value.trim()) {
    throw new Error('QR Code content cannot be empty')
  }

  try {
    const qrCodeData = await QRCode.toDataURL(value, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#166534',
        light: '#FFFFFF'
      }
    })

    return qrCodeData
  } catch (error) {
    console.error('Failed to generate QR Code:', error)
    throw error
  }
}
