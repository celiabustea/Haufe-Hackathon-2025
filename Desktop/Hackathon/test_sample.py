# Test file with intentional issues for code review

def calculate_total(values):
    
    total=0
    for value in values:
        total = total +value  
    return total

def process_data( data ):
    
    result = []
    for i in range(len(data)):
        if i % 2 == 0:
            result.append( data[i] )  
    return result

class DataProcessor:
    def __init__(self):
        self.data=[]  
        self.count = 0
    
    def add_item(self,item):  
        self.data.append(item)
        self.count+=1  

    def get_items(self):
        return self.data

GLOBAL_CONFIG = {}

def fetch_api_data(url):
    import requests  # Import inside function
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        return None
