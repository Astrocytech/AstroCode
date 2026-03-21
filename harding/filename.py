
def coinChange(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0

    for i in range(1, amount + 1):
        for c in coins:
            if i >= c:
                dp[i] = min(dp[i], dp[i - c] + 1)

    return dp[-1]

# Test the function
coins = [1, 2, 5]
amount = 11
print(coinChange(coins, amount))

NEW CONTENT