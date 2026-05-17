import json


def test_get_restaurant_catalog(client):
    response = client.get('/api/v1/restaurants')
    assert response.status_code == 200
    data = response.get_json()
    assert 'restaurants' in data
    assert 'total_count' in data
    restaurant = data['restaurants'][0]
    required_fields = [
        'restaurant_id',
        'name',
        'cuisine_category',
        'avg_rating',
        'est_delivery_min',
        'delivery_fee_egp',
        'is_open',
        'status_label',
        'operating_hours_display'
    ]
    for field in required_fields:
        assert field in restaurant


def test_open_restaurant_status(client):
    response = client.get('/api/v1/restaurants')
    data = response.get_json()
    burger = next(
        r for r in data['restaurants']
        if r['name'] == 'Burger Palace'
    )
    assert burger['is_open'] is True
    assert burger['status_label'] == 'Open'
