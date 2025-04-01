import requests
from bs4 import BeautifulSoup
import csv
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Alla körningar Norrmalms El:
# 1-GET_PRICES_NorrmalmsEl.py Skrapar alla produkter. Kör 1 gång per vecka för att lägga till nya produkter. Skapar 1-GET_PRICES_OUTPUT_NorrmalmsEl.csv
# 2-MATCH_PRODUCTS_NorrmalmsEl.py Matcha NorrmalmsEls produkter mot våra för att få en mindre lista. Kör 1 gång per vecka efter 1. Skapar 2-MATCH_PRODUCTS_OUTPUT_NorrmalmsEl.csv
# 3-UPDATE_PPRICES_NorrmalmsEl.py Hämta priser för matchade produkter. Kör dagligen. Uppdaterar 2-MATCH_PRODUCTS_OUTPUT_NorrmalmsEl.csv och laddar upp den på FTP:n.

# 1-GET_PRICES_NorrmalmsEl.py skrapar alla produkter från Norrmalms El via derad varumärkesida och skriver dem till en CSV-fil.

def extract_detailed_product_info(url):
    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Produktnamn
        product_name_tag = soup.find('h1', {'data-testid': 'product-title'})
        product_name = product_name_tag.text.strip() if product_name_tag else 'N/A'
        
        # Lagerstatus
        stock_status_tag = soup.find('p', class_='sn66q0p')
        stock_status = stock_status_tag.find_all('span')[1].text.strip() if stock_status_tag else 'N/A'
        
        # Artikelnummer (SKU)
        sku = 'N/A'
        sku_table = soup.find('tr')
        if sku_table:
            th_tags = sku_table.find_all('th')
            for th in th_tags:
                if th.text.strip() == 'Artikelnummer':
                    sku = th.find_next('td').text.strip()
                    break
        
        # Tillverkare
        manufacturer_tag = soup.find('h4', id='drop-header-brand')
        manufacturer = manufacturer_tag.find('span', class_='drop-text').text.strip() if manufacturer_tag else 'N/A'
        
        # Pris
        meta_price = soup.find('meta', {'property': 'product:price:amount'})
        if meta_price:
            price_cleaned = meta_price['content'].strip()
            # print(f"Price extracted from metadata: {price_cleaned}")
        else:
            # Om priset inte finns i metadatan, leta efter det i HTML-strukturen
            price_cleaned = 'N/A'
            price_div = soup.find('div', class_='price n77d0ua')
            if price_div:
                price_amount = price_div.text.strip()
                print(f"Original price amount: {price_amount}")
                # Remove non-digit characters except for thousands separator
                price_cleaned = re.sub(r'[^\d]', '', price_amount.replace('\xa0', ''))
                print(f"Cleaned price amount: {price_cleaned}")
            
        product_info = {
            'product_name': product_name,
            'stock_status': stock_status,
            'sku': sku,
            'manufacturer': manufacturer,
            'price': price_cleaned,
            'url': url
        }

        print(f"Fetched detailed data for {product_name}: {manufacturer}, {price_cleaned}, {stock_status}")
        return product_info
    except Exception as e:
        print(f"Error processing {url}: {e}")
        return None

def extract_product_links_from_brand_page(url):
    product_links = []
    while url:
        try:
            response = requests.get(url)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            product_containers = soup.select('div.product-card a')
            for container in product_containers:
                link = 'https://www.norrmalmsel.se' + container['href']
                print(f"Found product link: {link}")
                product_links.append(link)
            
            next_page_tag = soup.find('a', class_='s17fl53a s5htbx1')
            if next_page_tag and 'href' in next_page_tag.attrs:
                url = 'https://www.norrmalmsel.se' + next_page_tag['href']
            else:
                url = None
        except Exception as e:
            print(f"Error processing brand page {url}: {e}")
            break
    return product_links

def extract_brand_links(url):
    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.content, 'html.parser')
        brand_links = []
        
        brand_containers = soup.select('li.s1e1rog7 a')
        for container in brand_containers:
            link = 'https://www.norrmalmsel.se' + container['href']
            print(f"Found brand link: {link}")
            brand_links.append(link)
        
        return brand_links
    except Exception as e:
        print(f"Error processing page {url}: {e}")
        return []

def write_to_csv(data, filename='1-GET_PRICES_OUTPUT_Norrmalmsel.csv', write_header=False, mode='a'):
    data = [item for item in data if item is not None]  # Filtrera bort None-värden
    if not data:
        return
    keys = data[0].keys()
    with open(filename, mode, newline='', encoding='utf-8') as output_file:
        dict_writer = csv.DictWriter(output_file, fieldnames=keys, delimiter=';')
        if write_header:
            dict_writer.writeheader()
        dict_writer.writerows(data)

def send_email(total_products, hours, minutes, seconds):
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    smtp_user = "lejonfelt@gmail.com"
    smtp_password = "eput smdz ydaa katt"
    sender_email = smtp_user
    receiver_email = "info@ljustema.se"

    body = f"Prisuppdateringar av Norrmalmsel är klar. {total_products} st produkter har skrapats och är skrivna till filen 1-GET_PRICES_OUTPUT_Norrmalmsel.csv. Nästa steg är att köra 2-MATCH_PRODUCTS_Norrmalmsel.py. Denna skrapning tog {int(hours)}h {int(minutes)}min {int(seconds)}sek att utföra."

    message = MIMEMultipart()
    message["From"] = smtp_user
    message["To"] = receiver_email
    message["Subject"] = "Skrapningen av Norrmalmsel är klar"
    message.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(sender_email, receiver_email, message.as_string())
            print("E-postmeddelandet skickades.")
    except Exception as e:
        print(f"Det gick inte att skicka e-postmeddelandet: {e}")

def remove_file(filename):
    if os.path.exists(filename):
        os.remove(filename)

def process_brand(url, seen_skus, limit=None):
    product_links = extract_product_links_from_brand_page(url)
    detailed_products = []
    count = 0
    with ThreadPoolExecutor(max_workers=30) as executor:
        for product_info in executor.map(extract_detailed_product_info, product_links):
            if product_info and product_info['sku'] not in seen_skus:
                detailed_products.append(product_info)
                seen_skus.add(product_info['sku'])
                count += 1
                if limit and count >= limit:
                    break
    return detailed_products

def main(test_mode=False):
    start_time = time.time()
    
    base_url = 'https://www.norrmalmsel.se/varumarken'
    all_products = []
    total_products = 0
    seen_skus = set()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file_path = os.path.join(script_dir, '1-GET_PRICES_OUTPUT_Norrmalmsel.csv')
    
    remove_file(csv_file_path)
    
    brand_links = extract_brand_links(base_url)
    
    # Begränsa antalet varumärken och produkter i testläge
    if test_mode:
        brand_links = brand_links[:1]  # Bearbeta endast ett varumärke i testläge

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_to_url = {executor.submit(process_brand, url, seen_skus, limit=50 if test_mode else None): url for url in brand_links}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                data = future.result()
                all_products.extend(data)
                total_products += len(data)
                print(f"Processed {url}, added {len(data)} products")
            except Exception as e:
                print(f"Error processing {url}: {e}")
            
            if len(all_products) >= 100:
                write_to_csv(all_products, filename=csv_file_path, write_header=not os.path.exists(csv_file_path))
                all_products = []
        
            if test_mode and total_products >= 50:
                break

    if all_products:
        write_to_csv(all_products, filename=csv_file_path, write_header=not os.path.exists(csv_file_path))
    
    end_time = time.time()
    elapsed_time = end_time - start_time
    hours, remainder = divmod(elapsed_time, 3600)
    minutes, seconds = divmod(remainder, 60)
    
    send_email(total_products, hours, minutes, seconds)
    
    print(f"Skrapningen av Norrmalmsel är klar. {total_products} produkter är skrapade. CSV filen har skapats {csv_file_path}")
    print(f"Skrapningen tog {int(hours)} tim {int(minutes)} min {int(seconds)} sekunder")
    print(f"Nästa steg är att köra 2-MATCH_PRODUCTS_Norrmalmsel.py.")

if __name__ == "__main__":
    main(test_mode=False) # Sätt test_mode till True för att bara skrapa en sida
