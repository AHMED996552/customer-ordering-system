from unittest.mock import patch


@patch('app.services.restaurant_service.get_server_time')
def test_restaurant_closed_before_opening(mock_time, client):
    mock_time.return_value = '09:59'
    response = client.get('/api/v1/restaurants')
    data = response.get_json()
    burger = next(
        r for r in data['restaurants']
        if r['name'] == 'Burger Palace'
    )
    assert burger['is_open'] is False
    assert burger['status_label'] == 'Currently Closed'


@patch('app.services.restaurant_service.get_server_time')
def test_restaurant_open_at_boundary(mock_time, client):
    mock_time.return_value = '10:00'
    response = client.get('/api/v1/restaurants')
    data = response.get_json()
    burger = next(
        r for r in data['restaurants']
        if r['name'] == 'Burger Palace'
    )
    assert burger['is_open'] is True


@patch('app.services.restaurant_service.get_server_time')
def test_cross_midnight_restaurant_open(mock_time, client):
    mock_time.return_value = '23:00'
    response = client.get('/api/v1/restaurants')
    data = response.get_json()
    night_bites = next(
        r for r in data['restaurants']
        if r['name'] == 'Night Bites'
    )
    assert night_bites['is_open'] is True
    assert night_bites['status_label'] == 'Open'


@patch('app.services.restaurant_service.get_server_time')
def test_cross_midnight_restaurant_closed(mock_time, client):
    mock_time.return_value = '05:00'
    response = client.get('/api/v1/restaurants')
    data = response.get_json()
    night_bites = next(
        r for r in data['restaurants']
        if r['name'] == 'Night Bites'
    )
    assert night_bites['is_open'] is False
