//
//  AfterScanViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/21/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

class AfterScanViewController: BaseUIViewController {

    @IBOutlet private weak var iconImageView: UIImageView!
    @IBOutlet private weak var dashLineView: UIView!
    @IBOutlet private weak var gatewayNameLabel: UILabel!
    @IBOutlet private weak var sumDevicesLabel: UILabel!
    @IBOutlet private weak var statusLabel: UILabel!
    @IBOutlet private weak var mapView: UIView!
    
    private static let oneLine = 1
    private static let twoLine = 2
    private let defaultLocation = CLLocation(latitude: 16.0303493, longitude: 108.2245596)
    
    private var presenter: AfterScanPresenter!
    private var navigator: AfterScanNavigator!
    
    private var locationManager = CLLocationManager()
    private var currentLocation: CLLocation?
    private var googleMapView: GMSMapView!
    private var zoomLevel: Float = 14.5
    
    private var gateway: Gateway?
    private var device: Device?
    private var qrCode: String!
    
    static func create(qrCode: String) -> AfterScanViewController {
        let viewController: AfterScanViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.qrCode = qrCode
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = AfterScanPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        navigator = AfterScanNavigatorImpl(viewController: self)
        setupUI()
        requestData()
    }
    
    private func setupUI() {
        title = Strings.ScanQRCode.afterScan
        dashLineView.addDashedLineCenterVertical()
        setupCurrentLocation()
        setupGoogleMap()
    }
    
    private func requestData() {
        presenter.requestGatewayOrDevice(qrCode: qrCode)
    }
    
    @IBAction func didTouchDetails(_ sender: Any) {
        if let gateway = self.gateway {
            navigator.showListDeviceInGatewayScreen(gateway: gateway)
            return
        }
        if let device = self.device {
            navigator.showDeviceDetailsScreen(device: device)
        }
    }
}

// MARK: - Current location
extension AfterScanViewController: CLLocationManagerDelegate {
    
    private func setupCurrentLocation() {
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.delegate = self
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let camera = GMSCameraPosition.camera(withLatitude: location.coordinate.latitude, longitude: location.coordinate.longitude, zoom: zoomLevel)
        if googleMapView.isHidden {
            googleMapView.isHidden = false
            googleMapView.camera = camera
        } else {
            googleMapView.animate(to: camera)
        }
    }
}

// MARK: - Handle Google map
extension AfterScanViewController {
    
    private func setupGoogleMap() {
        let camera = GMSCameraPosition.camera(withLatitude: defaultLocation.coordinate.latitude, longitude: defaultLocation.coordinate.longitude, zoom: zoomLevel)
        googleMapView = GMSMapView.map(withFrame: mapView.frame, camera: camera)
        googleMapView.settings.myLocationButton = true
        googleMapView.isMyLocationEnabled = true
        mapView.addSubview(googleMapView)
        let authorizationStatus = CLLocationManager.authorizationStatus()
        switch authorizationStatus {
        case .notDetermined, .restricted, .denied:
            googleMapView.isHidden = false
        case .authorizedAlways, .authorizedWhenInUse:
            googleMapView.isHidden = true
        @unknown default:
            break
        }
    }
    
    private func markerDevice(device: Device) {
        if let position = device.location {
            let marker = GMSMarker(position: position)
            marker.title = device.name
            marker.icon = device.type() == .sensor ? #imageLiteral(resourceName: "ic_sensor_marker.pdf") : #imageLiteral(resourceName: "ic_valve_marker.pdf")
            marker.map = googleMapView
            let camera = GMSCameraPosition.camera(withTarget: position, zoom: zoomLevel)
            googleMapView.animate(to: camera)
        }
    }
    
    private func markerGateway(gateway: Gateway) {
        if let position = gateway.location {
            let marker = GMSMarker(position: position)
            marker.title = gateway.name
            marker.icon = #imageLiteral(resourceName: "ic_gateway_marker.pdf")
            marker.map = googleMapView
            let camera = GMSCameraPosition.camera(withTarget: position, zoom: zoomLevel)
            googleMapView.animate(to: camera)
        }
    }
}

// MARK: - Setup View
extension AfterScanViewController {
    
    func setup(gateway: Gateway) {
        gatewayNameLabel.text = gateway.name
        sumDevicesLabel.text = Strings.Gateway.devives.localizeWithFormat(arguments: gateway.devices.count)
    }
    
    func setup(gateway: Gateway?, type: DeviceType) {
        self.gatewayNameLabel.text = type.title()
        self.iconImageView.image = type.image()
        var sumDevices = 0
        if let gateway = gateway {
            sumDevices = type == .sensor ? gateway.sumSensorDevice() : gateway.sumValvesDevice()
        }
        self.sumDevicesLabel.text = Strings.Gateway.devives.localizeWithFormat(arguments: sumDevices)
    }
    
    func setup(device: Device, type: DeviceType) {
        if type == .valve, let isOn = device.isOn {
            self.gatewayNameLabel.numberOfLines = AfterScanViewController.oneLine
            self.statusLabel.text = isOn ? Strings.Device.on : Strings.Device.off
            self.statusLabel.textColor = isOn ? .green : .red
            self.gatewayNameLabel.text = device.name + ":"
        } else {
            self.gatewayNameLabel.numberOfLines = AfterScanViewController.twoLine
            self.statusLabel.text = ""
            self.gatewayNameLabel.text = device.name
        }
        self.iconImageView.image = type.image()
        self.sumDevicesLabel.isHidden = false
        if let timestamp = device.timestamp {
            let date = Date(timeIntervalSince1970: timestamp)
            self.sumDevicesLabel.text = getDistanceDateChange(date: date)
        } else {
            self.sumDevicesLabel.text = Strings.Main.unknow
            self.sumDevicesLabel.isHidden = true
        }
    }
    
    private func getDistanceDateChange(date: Date) -> String {
        let minutesAgo = Date().minutesFrom(date: date)
        let hoursAgo = Date().hoursFrom(date: date)
        let daysAgo = Date().daysFrom(date: date)
        let yearsAgo = Date().yearsFrom(date: date)
        if yearsAgo != 0 {
            return Strings.DateTimeDistance.yearsAgo(number: yearsAgo)
        }
        if daysAgo != 0 {
            return Strings.DateTimeDistance.daysAgo(number: daysAgo)
        }
        if hoursAgo != 0 {
            return Strings.DateTimeDistance.hoursAgo(number: hoursAgo)
        }
        if minutesAgo != 0 {
            return Strings.DateTimeDistance.minutesAgo(number: minutesAgo)
        }
        return "\(date)"
    }
}

extension AfterScanViewController: AfterScanIView {
    
    func invalidate(error: String) {
        self.showAlertWithMessage(message: error)
    }
    
    func foundedDevice(device: Device) {
        self.device = device
        setup(device: device, type: device.type())
        markerDevice(device: device)
    }
    
    func foundedGateway(gateway: Gateway) {
        self.gateway = gateway
        setup(gateway: gateway)
        markerGateway(gateway: gateway)
    }
    
    func notFoundGatewayOrDevice() {
        self.showAlertWithMessage(message: Strings.ScanQRCode.notFoundGatewayOrDevice) {
            self.navigator.backToPreviousScreen()
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
