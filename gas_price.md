# Gas Price RESTful sensor

It can be useful to see how much gas currently costs at a particular station. GasBuddy has an unpublished API that exposes this information.

Unfortunately, due to limitations in how RESTful integrations work, you _cannot_ use secrets, or any other template variable, so the id of the service station that I prefer would be public. I'd rather not expose this information about myself, so I've written the integration as a generic one below.

To get your station ID, visit https://gasbuddy.com/ and find the station in question. You can then copy the id out of the url into this file

```yaml
- scan_interval: 3600
  resource: https://www.gasbuddy.com/graphql
  method: POST
  headers:
    Content-Type: application/json
  payload: |
    {
      "variables": {},
      "query": "query { station(id: \"<INSERT YOUR STATION ID HERE>\") { prices { credit { price } } } } "
    }
  sensor:
    - unique_id: gas_price
      name: Gas Price
      icon: mdi:gas-station
      unit_of_measurement: USD
      state_class: measurement
      force_update: true
      value_template: "{{ value_json.data.station.prices.0.credit.price | float }}"
      availability: "{{ value_json.data.station.prices.0.credit.price | float > 0 }}"
```

If you want to just get the average, or lowest price in your area, you can use this modified version:

```yaml
- scan_interval: 3600
  resource: https://www.gasbuddy.com/graphql
  method: POST
  headers:
    Content-Type: application/json
  payload: |
    {
      "variables": {},
      "query": "query { locationBySearchTerm(search: \"<YOUR POSTAL CODE HERE>\") { trends { today todayLow } } }"
    }
  sensor:
    - unique_id: lowest_gas_price
      name: Lowest Gas Price
      icon: mdi:gas-station
      unit_of_measurement: USD
      state_class: measurement
      force_update: true
      value_template: "{{ value_json.data.locationBySearchTerm.trends.0.todayLow | float }}"
      availability: "{{ value_json.data.locationBySearchTerm.trends.0.todayLow | float > 0 }}"
    - unique_id: avg_gas_price
      name: Average Gas Price
      icon: mdi:gas-station
      unit_of_measurement: USD
      state_class: measurement
      force_update: true
      value_template: "{{ value_json.data.locationBySearchTerm.trends.0.today | float }}"
      availability: "{{ value_json.data.locationBySearchTerm.trends.0.today | float > 0 }}"
```

You can explore the API a bit more as you like. I know that they expose the address/location of the lowest priced station, via an `address` struct, so it's possible to pull that information into HomeAssistant
