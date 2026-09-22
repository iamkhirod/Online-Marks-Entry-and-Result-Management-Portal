import base64

with open(r'c:\Users\ASUS\Desktop\PPD_LAb\images\marksheet_header.png', 'rb') as f:
    hdr_b64 = base64.b64encode(f.read()).decode('utf-8')

with open(r'c:\Users\ASUS\Desktop\PPD_LAb\images\signature.png', 'rb') as f:
    sig_b64 = base64.b64encode(f.read()).decode('utf-8')

with open(r'c:\Users\ASUS\Desktop\PPD_LAb\js\assets_b64.js', 'w', encoding='utf-8') as f:
    f.write('const MARKSHEET_HEADER_B64 = "data:image/png;base64,' + hdr_b64 + '";\n')
    f.write('const SIGNATURE_B64 = "data:image/png;base64,' + sig_b64 + '";\n')

print("Assets base64 generated successfully in js/assets_b64.js")
