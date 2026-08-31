//
//  MapsViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/14/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

typealias DeviceMarker = (deviceID: String, marker: GMSMarker)
typealias GatewayMarker = (gatewayID: String, marker: GMSMarker)

class MapViewController: BaseUIViewController {
    
    private var presenter: MapPresenter!
    
    private var locationManager = CLLocationManager()
    private var currentLocation: CLLocation?
    private var mapView: GMSMapView!
    private var zoomLevel: Float = 14.5
    
    private var gatewayIDs = [String]()
    private var listGatewayDetail = [Gateway]()
    private var deviceMarkers = [DeviceMarker]()
    private var gatewayMarkers = [GatewayMarker]()
    private var isOnlyFollowInListGateway: Bool = false
    private var isOnlyShowDevices: Bool = false
    private var deviceType: DeviceType?
    
    private let defaultLocation = CLLocation(latitude: 16.0303493, longitude: 108.2245596)
    
    static func create(gatewayIDs: [String], isOnlyFollowInListGateway: Bool = false, isOnlyShowDevices: Bool = false, deviceType: DeviceType? = nil) -> UIViewController {
        let viewController: MapViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.gatewayIDs = gatewayIDs
        viewController.isOnlyFollowInListGateway = isOnlyFollowInListGateway
        viewController.isOnlyShowDevices = isOnlyShowDevices
        viewController.deviceType = deviceType
        return viewController
    }
    
    override func loadView() {
        setupCurrentLocation()
        setupGoogleMap()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = MapPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        setupUI()
        requestData()
    }
    
    private func setupUI() {
        self.title = Strings.Map.map
    }
    
    private func requestData() {
        for gatewayID in gatewayIDs {
            observeGatewayData(gatwayID: gatewayID)
        }
        if !isOnlyFollowInListGateway {
            presenter.observeGatewayAdd()
        }
    }
    
    private func observeGatewayData(gatwayID: String) {
        presenter.observeGatewayData(gatewayID: gatwayID)
        presenter.observeGatewayDelete(gatewayID: gatwayID)
    }
}

// MARK: - Current location
extension MapViewController: CLLocationManagerDelegate {
    
    private func setupCurrentLocation() {
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.delegate = self
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, currentLocation == nil else { return }
        currentLocation = location
        let camera = GMSCameraPosition.camera(withLatitude: location.coordinate.latitude, longitude: location.coordinate.longitude, zoom: zoomLevel)
        if mapView.isHidden {
            mapView.isHidden = false
            mapView.camera = camera
        } else {
            mapView.animate(to: camera)
        }
    }
}

// MARK: - Handle Google map
extension MapViewController {
    
    private func setupGoogleMap() {
        let camera = GMSCameraPosition.camera(withLatitude: defaultLocation.coordinate.latitude, longitude: defaultLocation.coordinate.longitude, zoom: zoomLevel)
        mapView = GMSMapView.map(withFrame: CGRect.zero, camera: camera)
        mapView.settings.myLocationButton = true
        mapView.isMyLocationEnabled = true
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
    
    private func markerDevices(devices: [Device]) {
        for device in devices {
            markerDevice(device: device)
        }
    }
    
    private func markerGateways(gateways: [Gateway]) {
        for gateway in gateways {
            markerGateway(gateway: gateway)
        }
    }
    
    private func updateMarker(oldGateway: Gateway, gatewayChanged: Gateway) {
        removeMarker(of: oldGateway)
        markerGateway(gateway: gatewayChanged)
        markerDevices(devices: gatewayChanged.devices)
    }
    
    private func markerDevice(device: Device) {
        guard self.deviceType == nil || self.deviceType == device.type() else { return }
        if let position = device.location {
            let marker = GMSMarker(position: position)
            marker.title = device.name
            marker.icon = device.type() == .sensor ? #imageLiteral(resourceName: "ic_sensor_marker.pdf") : #imageLiteral(resourceName: "ic_valve_marker.pdf")
            marker.map = mapView
            let deviceMarker = DeviceMarker(device.id, marker)
            deviceMarkers.append(deviceMarker)
        }
    }
    
    private func markerGateway(gateway: Gateway) {
        guard !isOnlyShowDevices else { return }
        if let position = gateway.location {
            let marker = GMSMarker(position: position)
            marker.title = gateway.name
            marker.icon = #imageLiteral(resourceName: "ic_gateway_marker.pdf")
            marker.map = mapView
            let gatewayMarker = GatewayMarker(gateway.id, marker)
            gatewayMarkers.append(gatewayMarker)
        }
    }
    
    private func removeMarker(of gateway: Gateway) {
        if let index = gatewayMarkers.firstIndex(where: { $0.gatewayID == gateway.id }) {
            gatewayMarkers[index].marker.map = nil
            gatewayMarkers.remove(at: index)
        }
        for device in gateway.devices {
            if let index = deviceMarkers.firstIndex(where: { $0.deviceID == device.id }) {
                deviceMarkers[index].marker.map = nil
                deviceMarkers.remove(at: index)
            }
        }
    }
}

extension MapViewController: MapIView {
    
    func gatewayAdded(gatewayID: String) {
        guard !gatewayIDs.contains(gatewayID) else { return }
        gatewayIDs.append(gatewayID)
        observeGatewayData(gatwayID: gatewayID)
    }
    
    func gatewayDataChanged(gateway: Gateway) {
        if let indexChange = listGatewayDetail.firstIndex(where: { $0.id == gateway.id }) {
            updateMarker(oldGateway: listGatewayDetail[indexChange], gatewayChanged: gateway)
            listGatewayDetail[indexChange] = gateway
        } else {
            gatewayIDs.append(gateway.id)
            listGatewayDetail.append(gateway)
            markerDevices(devices: gateway.devices)
            markerGateway(gateway: gateway)
        }
    }
    
    func gatewayDeleted(gatewayID: String) {
        if let index = gatewayIDs.firstIndex(where: { $0 == gatewayID }) {
            gatewayIDs.remove(at: index)
        }
        if let indexDelete = listGatewayDetail.firstIndex(where: { $0.id == gatewayID }) {
            removeMarker(of: listGatewayDetail[indexDelete])
            listGatewayDetail.remove(at: indexDelete)
        }
    }
    
    func showLoadingProgress() {
        self.showLoadingInsideView()
    }
    
    func hideLoadingProgress() {
        self.hideLoadingInsideView()
    }
    
    func showError(error: Error) {
        self.showErrorAlert(error.localizedDescription)
    }
}
