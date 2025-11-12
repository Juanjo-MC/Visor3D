export class Device{
	static isMobile(){
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent#mobile_tablet_or_desktop
		return navigator.userAgent.includes('Mobile');
	}
	static hasMouse(){
		return window.matchMedia('(pointer: fine)').matches;
	}
}