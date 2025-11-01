# Example Python code with issues for testing

def calculate_sum(list):  # Should not shadow built-in
    total = 0
    for i in range(len(list)):
        total += list[i]
    return total


def get_user_data(x):  # Unclear variable name
    data = {}
    data["id"] = x[0]
    data["name"] = x[1]
    data["email"] = x[2]
    if data["name"] == "":
        pass
    return data


class Calculator:
    # Missing docstring
    
    def divide(self, a, b):
        result = a / b
        return result
