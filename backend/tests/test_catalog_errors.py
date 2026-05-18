from unittest.mock import patch


@patch('app.routes.restaurants.get_all_restaurants')
def test_catalog_service_unavailable(mock_service, client):
    mock_service.side_effect = Exception('DB failure')
    response = client.get('/api/v1/restaurants')
    assert response.status_code == 503
    data = response.get_json()
    assert data['error']['code'] == 'SERVICE_UNAVAILABLE'
