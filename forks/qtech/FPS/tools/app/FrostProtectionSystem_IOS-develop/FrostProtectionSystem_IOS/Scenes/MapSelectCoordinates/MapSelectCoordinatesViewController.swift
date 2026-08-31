//
//  MapSelectCoordinatesViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/17/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

protocol MapSelectCoordinatesDelegate: class {
    func mapSelectCoordinatesDelegate(didSelected location: CLLocationCoordinate2D?)
}

class MapSelectCoordinatesViewController: BaseUIViewController {
    
    weak var delegate: MapSelectCoordinatesDelegate?
    private var navigator: MapSelectCoodinatesNavigator!
    
    private var locationManager = CLLocationManager()
    private var currentLocation: CLLocation?
    private var location: CLLocationCoordinate2D?
    private var mapView: GMSMapView!
    private var marker: GMSMarker?
    private var zoomLevel: Float = 14.5
    private let defaultLocation = CLLocation(latitude: 16.0303493, longitude: 108.2245596)
    
    static func create(location: CLLocationCoordinate2D?, delegate: MapSelectCoordinatesDelegate?) -> UIViewController {
        let viewController: MapSelectCoordinatesViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.location = location
        viewController.delegate = delegate
        return viewController
    }
    
    override func loadView() {
        setupCurrentLocation()
        setupGoogleMap()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        navigator = MapSelectCoodinatesNavigatorImpl(viewController: self)
        setupUI()
    }
    
    private func setupGoogleMap() {
        var camera: GMSCameraPosition
        if let location = self.location {
            camera = GMSCameraPosition.camera(withTarget: location, zoom: zoomLevel)
        } else {
            camera = GMSCameraPosition.camera(withLatitude: defaultLocation.coordinate.latitude, longitude: defaultLocation.coordinate.longitude, zoom: zoomLevel)
        }
        mapView = GMSMapView.map(withFrame: CGRect.zero, camera: camera)
        mapView.settings.myLocationButton = true
        mapView.isMyLocationEnabled = true
        mapView.delegate = self
        view = mapView
        let authorizationStatus = CLLocationManager.authorizationStatus()
        switch authorizationStatus {
        case .notDetermined, .restricted, .denied:
            mapView.isHidden = false
        case .authorizedAlways, .authorizedWhenInUse:
            mapView.isHidden = true
        @unknown default:
            break
        }
    }
    
    private func setupUI() {
        self.title = Strings.Map.selectCoodinates
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: Strings.Map.select, style: .done, target: self, action: #selector(didTapSelectCoordinates))
        guard let location = self.location else { return }
        marker = GMSMarker(position: location)
        marker?.map = mapView
    }
    
    @objc private func didTapSelectCoordinates() {
        delegate?.mapSelectCoordinatesDelegate(didSelected: location)
        navigator.backToPreviousScreen()
    }
}
// MARK: - Current location
extension MapSelectCoordinatesViewController: CLLocationManagerDelegate {
    
    private func setupCurrentLocation() {
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.delegate = self
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, currentLocation == nil else { return }
        self.currentLocation = location
        let camera = GMSCameraPosition.camera(withLatitude: location.coordinate.latitude, longitude: location.coordinate.longitude, zoom: zoomLevel)
        if mapView.isHidden {
            mapView.isHidden = false
            if self.location == nil {
                mapView.camera = camera
            }
        } else if self.location == nil {
            mapView.animate(to: camera)
        }
    }
}

extension MapSelectCoordinatesViewController: GMSMapViewDelegate {
    
    func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
        if let marker = marker {
            marker.position = coordinate
        } else {
            marker = GMSMarker(position: coordinate)
            marker?.map = mapView
        }
        location = coordinate
    }
}
