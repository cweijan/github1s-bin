declare module 'tas-client-umd' {
	/**
	 * Provides a value for the given filter.
	 * This filters are used in within the Feature providers.
	 */
	export interface IExperimentationFilterProvider {
		/**
		 * Get filter value by enum
		 * @param filter The filter type.
		 */
		getFilters(): Map<string, any>;
	}

	/**
	 * Experimentation service provides A/B experimentation functionality.
	 * Currently it's per design to be able to only allow querying one flight at the time.
	 * This is in order for us to control events and telemetry whenever these methods are called.
	 */
	export interface IExperimentationService {
		/**
		 * Promise indicating that the experimentation service has been
		 * initialized, so it's safe to make a call to isFlightEnabled.
		 */
		readonly initializePromise: Promise<void>;
		/**
		 * Returns a value indicating whether the given flight is enabled.
		 * It uses the values currently in memory, so the experimentation service
		 * must be initialized before calling.
		 * @param flight The flight to check.
		 */
		isFlightEnabled(flight: string): boolean;
		/**
		 * Returns a value indicating whether the given flight is enabled.
		 * It uses the values currently on cache.
		 * @param flight The flight to check.
		 */
		isCachedFlightEnabled(flight: string): Promise<boolean>;
		/**
		 * Returns a value indicating whether the given flight is enabled.
		 * It re-fetches values from the server.
		 * @param flight the flight to check.
		 */
		isFlightEnabledAsync(flight: string): Promise<boolean>;
		/**
		 * Returns the value of the treatment variable, or undefined if not found.
		 * It uses the values currently in memory, so the experimentation service
		 * must be initialized before calling.
		 * @param config name of the config to check.
		 * @param name name of the treatment variable.
		 */
		getTreatmentVariable<T extends boolean | number | string>(configId: string, name: string): T | undefined;
		/**
		 * Returns the value of the treatment variable, or undefined if not found.
		 * It re-fetches values from the server.
		 * @param config name of the config to check.
		 * @param name name of the treatment variable.
		 */
		getTreatmentVariableAsync<T extends boolean | number | string>(configId: string, name: string): Promise<T | undefined>;
	}

	/**
	 * Telemetry for the experimentation service.
	 */
	export interface IExperimentationTelemetry {
		/**
		 * Set shared property for all events.
		 * @param name The name of the shared property.
		 * @param value The value of the shared property.
		 */
		setSharedProperty(name: string, value: string): void;
		/**
		 * Posts an event into the telemetry implementation.
		 */
		postEvent(eventName: string, props: Map<string, string>): void;
	}

	/**
	 * Interface used for a key-value storage implementation.
	 */
	export interface IKeyValueStorage {
		/**
		 * Gets current value from the storage.
		 * @param key The key of the value that wants to be retrieved from the storage.
		 * @param defaultValue The default value to return in case no value was found for given key.
		 */
		getValue<T>(key: string, defaultValue?: T): Promise<T | undefined>;
		/**
		 * Sets value to the storage.
		 * @param key The key that will be attached to the value in the storage.
		 * @param value The value to store.
		 */
		setValue<T>(key: string, value: T): void;
	}

	interface ConfigData {
		Id: string;
		Parameters: Parameters;
	}
	interface Parameters {
		[key: string]: boolean | number | string;
	}
	interface FeatureData {
		features: string[];
		assignmentContext: string;
		configs: ConfigData[];
	}
	interface IFeatureProvider {
		/**
		 * Features property. Usually contains the cached features, but if called before having cache it will fetch from the server.
		 */
		getFeatures(): Promise<FeatureData>;
	}

	/**
	 * Abstract class for Feature Provider Implementation.
	 */
	abstract class BaseFeatureProvider implements IFeatureProvider {
		protected telemetry: IExperimentationTelemetry;
		private fetchPromise?;
		private isFetching;
		/**
		 * @param telemetry The telemetry implementation.
		 */
		constructor(telemetry: IExperimentationTelemetry);
		/**
		 * Method that wraps the fetch method in order to re-use the fetch promise if needed.
		 * @param headers The headers to be used on the fetch method.
		 */
		getFeatures(): Promise<FeatureData>;
		/**
		 * Fetch method that retrieves asynchronously the required feature data.
		 */
		protected abstract fetch(): Promise<FeatureData>;
	}

	/**
	 * Feature provider implementation that handles filters.
	 */
	abstract class FilteredFeatureProvider extends BaseFeatureProvider {
		protected telemetry: IExperimentationTelemetry;
		protected filterProviders: IExperimentationFilterProvider[];
		constructor(telemetry: IExperimentationTelemetry, filterProviders: IExperimentationFilterProvider[]);
		private cachedTelemetryEvents;
		protected getFilters(): Map<string, any>;
		protected PostEventToTelemetry(headers: any): void;
	}

	interface TASFeatureData {
		Features: any[];
		Flights: any[];
		Configs: ConfigData[];
		ParameterGroups: any[];
		FlightingVersion: number;
		ImpressionId: string;
		FlightingEnrichments: any;
		AssignmentContext: string;
	}

	/**
	 * Options that include the implementations of the Experimentation service.
	 */
	export interface ExperimentationServiceConfig {
		telemetry: IExperimentationTelemetry;
		endpoint: string;
		/**
		 * If there's any specific filter provider for the endpoint filters, it's defined or added into this list.
		 */
		filterProviders?: IExperimentationFilterProvider[];
		/**
		 * A string containing the name for the features telemetry property.
		 * This option is implemented in IExperimentation Telemetry.
		 * This options posts to the implementation a list of
		 * available features for the client, separated by ';'
		 */
		featuresTelemetryPropertyName: string;
		/**
		 * A string containing the name for the assignment context telemetry property.
		 * This option is implemented in IExperimentation Telemetry.
		 * This options posts to the implementation the assignment context.
		 */
		assignmentContextTelemetryPropertyName: string;
		/**
		 * The name for the telemetry event. This event will be posted every time a flight is queried.
		 */
		telemetryEventName: string;
		/**
		 * Refetch interval overrides the interval in milliseconds the polling will take in between polls.
		 * If set to 0 there will be no polling for this experimentation service.
		 */
		refetchInterval?: number;
		/**
		 * The key value storage key. Often used as the identifier of the storage.
		 * By default it's set to ABExp.Features
		 */
		storageKey?: string;
		/**
		 * An implemention for key value storage usage.
		 */
		keyValueStorage?: IKeyValueStorage;
	}

	class MemoryKeyValueStorage implements IKeyValueStorage {
		private storage;
		getValue<T>(key: string, defaultValue?: T): Promise<T | undefined>;
		setValue<T>(key: string, value: T): void;
	}

	/**
	 * Experimentation service to provide functionality of A/B experiments:
	 * - reading flights;
	 * - caching current set of flights;
	 * - get answer on if flights are enabled.
	 */
	abstract class ExperimentationServiceBase implements IExperimentationService {
		protected telemetry: IExperimentationTelemetry;
		protected featuresTelemetryPropertyName: string;
		protected assignmentContextTelemetryPropertyName: string;
		protected telemetryEventName: string;
		protected storageKey?: string | undefined;
		protected storage?: IKeyValueStorage | undefined;
		protected featureProviders?: IFeatureProvider[];
		protected fetchPromise?: Promise<FeatureData[]>;
		protected featuresConsumed: boolean;
		private loadCachePromise;
		readonly initializePromise: Promise<void>;
		private cachedTelemetryEvents;
		private _features;
		private get features();
		private set features(value);
		constructor(telemetry: IExperimentationTelemetry, featuresTelemetryPropertyName: string, assignmentContextTelemetryPropertyName: string, telemetryEventName: string, storageKey?: string | undefined, storage?: IKeyValueStorage | undefined);
		/**
		 * Gets all the features from the provider sources (not cache).
		 * It returns these features and will also update the providers to have the latest features cached.
		 */
		protected getFeaturesAsync(overrideInMemoryFeatures?: boolean): Promise<FeatureData>;
		/**
		 *
		 * @param featureResults The feature results obtained from all the feature providers.
		 */
		protected updateFeatures(featureResults: FeatureData[], overrideInMemoryFeatures?: boolean): void;
		private loadCachedFeatureData;
		/**
		 * Returns a value indicating whether the given flight is enabled.
		 * It uses the in-memory cache.
		 * @param flight The flight to check.
		 */
		isFlightEnabled(flight: string): boolean;
		/**
		 * Returns a value indicating whether the given flight is enabled.
		 * It uses the values currently on cache.
		 * @param flight The flight to check.
		 */
		isCachedFlightEnabled(flight: string): Promise<boolean>;
		/**
		 * Returns a value indicating whether the given flight is enabled.
		 * It re-fetches values from the server.
		 * @param flight the flight to check.
		 */
		isFlightEnabledAsync(flight: string): Promise<boolean>;
		/**
		 * Returns the value of the treatment variable, or undefined if not found.
		 * It uses the values currently in memory, so the experimentation service
		 * must be initialized before calling.
		 * @param config name of the config to check.
		 * @param name name of the treatment variable.
		 */
		getTreatmentVariable<T extends boolean | number | string>(configId: string, name: string): T | undefined;
		/**
		 * Returns the value of the treatment variable, or undefined if not found.
		 * It re-fetches values from the server.
		 * @param config name of the config to check.
		 * @param name name of the treatment variable.
		 */
		getTreatmentVariableAsync<T extends boolean | number | string>(configId: string, name: string): Promise<T | undefined>;
		private PostEventToTelemetry;
		protected invokeInit(): void;
		/**
		 * Method to do any post-base constructor calls.
		 * Consider this a constructor for the derived classes.
		 * Can be used to initialize the Feature Providers.
		 * No async calls should be done here.
		 */
		protected abstract init(): void;
		protected addFeatureProvider(...providers: IFeatureProvider[]): void;
	}

	class PollingService {
		private fetchInterval;
		private intervalHandle?;
		onTick: (() => Promise<void>) | undefined;
		constructor(fetchInterval: number);
		StopPolling(): void;
		OnPollTick(callback: () => Promise<void>): void;
		StartPolling(pollImmediately?: boolean): void;
	}

	/**
	 * Implementation of Feature provider that provides a polling feature, where the source can be re-fetched every x time given.
	 */
	abstract class ExperimentationServiceAutoPolling extends ExperimentationServiceBase {
		protected telemetry: IExperimentationTelemetry;
		protected filterProviders: IExperimentationFilterProvider[];
		protected refreshRateMs: number;
		protected featuresTelemetryPropertyName: string;
		protected assignmentContextTelemetryPropertyName: string;
		protected telemetryEventName: string;
		protected storageKey?: string | undefined;
		protected storage?: IKeyValueStorage | undefined;
		private pollingService?;
		constructor(telemetry: IExperimentationTelemetry, filterProviders: IExperimentationFilterProvider[], refreshRateMs: number, featuresTelemetryPropertyName: string, assignmentContextTelemetryPropertyName: string, telemetryEventName: string, storageKey?: string | undefined, storage?: IKeyValueStorage | undefined);
		protected init(): void;
		/**
		 * Wrapper that will reset the polling intervals whenever the feature data is fetched manually.
		 */
		protected getFeaturesAsync(overrideInMemoryFeatures?: boolean): Promise<FeatureData>;
	}

	/**
	* Experimentation service to provide functionality of A/B experiments:
	* - reading flights;
	* - caching current set of flights;
	* - get answer on if flights are enabled.
	*/
	export class ExperimentationService extends ExperimentationServiceAutoPolling {
		private options;
		static REFRESH_RATE_IN_MINUTES: number;
		protected featureProviders?: IFeatureProvider[];
		constructor(options: ExperimentationServiceConfig);
		protected init(): void;
	}
}